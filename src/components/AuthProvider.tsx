import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userRole: 'candidate' | 'employer' | 'admin' | null;
  loading: boolean;
  login: (role?: string) => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  makeMeAdmin: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRole, setUserRole] = useState<'candidate' | 'employer' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserRole = async () => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setUserRole(null);
      return;
    }

    try {
      // Check admin collection first
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        setIsAdmin(true);
        setIsSuperAdmin(adminData?.role === 'superadmin');
        setUserRole(adminData?.role === 'superadmin' ? 'admin' : 'employer');
        return;
      }

      // Check users collection for role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData?.role || 'candidate';
        setUserRole(role);
        setIsAdmin(role === 'employer' || role === 'admin');
        setIsSuperAdmin(role === 'admin');
        return;
      }

      // Default to candidate (will be created on next login)
      setUserRole('candidate');
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('candidate');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Try to create user profile if it doesn't exist
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (!userDoc.exists()) {
            // Create basic user profile
            await setDoc(doc(db, 'users', u.uid), {
              email: u.email,
              name: u.displayName || 'User',
              role: 'candidate',
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString()
            });
          } else {
            // Update last login
            await setDoc(doc(db, 'users', u.uid), {
              lastLogin: new Date().toISOString()
            }, { merge: true });
          }
        } catch (error) {
          console.error('Error ensuring user profile exists:', error);
        }
        await refreshUserRole();
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (role?: string) => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      
      // Check if user exists in users collection
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDoc.exists()) {
        // Create user profile
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email,
          name: cred.user.displayName || 'User',
          role: role || 'candidate',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      } else {
        // Update last login
        await setDoc(doc(db, 'users', cred.user.uid), {
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }

      // If employer or admin, check admin status
      if (role === 'employer' || role === 'admin') {
        const adminDoc = await getDoc(doc(db, 'admins', cred.user.uid));
        if (!adminDoc.exists()) {
          // Only super admin can create admin accounts, so this will fail if not super admin
          // But we'll try anyway
          await setDoc(doc(db, 'admins', cred.user.uid), {
            email: cred.user.email,
            name: cred.user.displayName || 'User',
            role: role || 'employer',
            assignedAt: new Date().toISOString(),
            createdBy: cred.user.uid
          });
        }
      }

      await refreshUserRole();
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const loginEmail = async (email: string, pass: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      // Update last login
      await setDoc(doc(db, 'users', cred.user.uid), {
        lastLogin: new Date().toISOString()
      }, { merge: true });
      await refreshUserRole();
    } catch (error: any) {
      console.error('Email login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const registerEmail = async (email: string, pass: string, name: string, role?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      
      // Create user profile
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        name,
        role: role || 'candidate',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });

      // If employer, add to admins collection
      if (role === 'employer') {
        await setDoc(doc(db, 'admins', cred.user.uid), {
          email,
          name,
          role: 'hr',
          assignedAt: new Date().toISOString(),
          createdBy: cred.user.uid
        });
      }

      await refreshUserRole();
      setUser(cred.user);
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Please check if you have the correct role.');
      }
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setUserRole(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Logout failed');
    }
  };

  const makeMeAdmin = async () => {
    if (!user) return;
    try {
      // Check if user is already admin
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        setIsAdmin(true);
        setUserRole('employer');
        return;
      }

      // Create admin document
      await setDoc(doc(db, 'admins', user.uid), {
        email: user.email,
        name: user.displayName || 'User',
        role: 'employer',
        assignedAt: new Date().toISOString(),
        createdBy: user.uid
      });

      // Update users collection
      await setDoc(doc(db, 'users', user.uid), {
        role: 'employer',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await refreshUserRole();
    } catch (error: any) {
      console.error('Make admin error:', error);
      throw new Error(error.message || 'Failed to make admin');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      isSuperAdmin, 
      userRole,
      loading, 
      login, 
      loginEmail, 
      registerEmail, 
      logout, 
      makeMeAdmin,
      refreshUserRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}