import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, onSnapshot, orderBy, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../AuthProvider';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  TrendingUp, 
  AlertCircle,
  Home,
  LogOut,
  ChevronDown,
  X,
  Shield,
  UserCog,
  CheckCircle2,
  Clock,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'candidate' | 'employer' | 'admin';
  createdAt: string;
  lastLogin?: string;
}

interface AdminData {
  id: string;
  email: string;
  name: string;
  role: 'employer' | 'superadmin';
  assignedAt: string;
}

export default function AdminDashboard({ onBackHome }: { onBackHome: () => void }) {
  const { user, isSuperAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'admins'>('overview');
  const [users, setUsers] = useState<UserData[]>([]);
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');

  useEffect(() => {
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      setUsers(userData);
    });

    const qAdmins = query(collection(db, 'admins'), orderBy('assignedAt', 'desc'));
    const unsubAdmins = onSnapshot(qAdmins, (snapshot) => {
      const adminData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminData));
      setAdmins(adminData);
    });

    return () => {
      unsubUsers();
      unsubAdmins();
    };
  }, []);

  const handlePromoteToAdmin = async (userId: string, userData: UserData) => {
    if (!confirm(`Promote ${userData.name} to admin?`)) return;
    try {
      await setDoc(doc(db, 'admins', userId), {
        email: userData.email,
        name: userData.name,
        role: 'employer',
        assignedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'users', userId), {
        role: 'employer',
        updatedAt: new Date().toISOString()
      });
      showToast('success', `${userData.name} promoted to admin successfully!`);
    } catch (err) {
      console.error('Error promoting user:', err);
      showToast('error', 'Failed to promote user');
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!confirm('Remove this admin? They will lose admin privileges.')) return;
    try {
      await deleteDoc(doc(db, 'admins', adminId));
      await updateDoc(doc(db, 'users', adminId), {
        role: 'candidate',
        updatedAt: new Date().toISOString()
      });
      showToast('success', 'Admin privileges removed successfully!');
    } catch (err) {
      console.error('Error removing admin:', err);
      showToast('error', 'Failed to remove admin');
    }
  };

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'indigo' },
    { label: 'Admins', value: admins.length, icon: Shield, color: 'amber' },
    { label: 'Candidates', value: users.filter(u => u.role === 'candidate').length, icon: Users, color: 'emerald' },
    { label: 'Employers', value: users.filter(u => u.role === 'employer').length, icon: Briefcase, color: 'blue' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <Shield className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">Admin Panel</span>
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'users', label: 'User Management', icon: Users },
              { id: 'admins', label: 'Admin Management', icon: Shield },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  activeTab === item.id 
                    ? 'bg-amber-50 text-amber-600 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-black uppercase text-amber-600">Super Admin</p>
            <p className="text-xs text-slate-600 font-medium mt-1">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h2>
          <div className="flex items-center gap-6">
            <button 
              onClick={onBackHome}
              className="hidden md:flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors text-sm font-bold"
            >
              <Home className="w-4 h-4" /> Home Page
            </button>

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-4 hover:bg-slate-50 transition-colors px-3 py-1.5 rounded-2xl"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-900">{user?.displayName}</p>
                  <p className="text-[10px] uppercase text-amber-600 font-bold tracking-widest">Super Admin</p>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border border-slate-100">
                  <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.displayName}`} alt="avatar" />
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20"
                    >
                      <button onClick={onBackHome} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium">
                        <Home className="w-4 h-4" />
                        Back to Home
                      </button>
                      <button onClick={() => logout()} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors font-medium">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">User Role Distribution</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Candidates', value: users.filter(u => u.role === 'candidate').length, color: 'indigo' },
                      { label: 'Employers', value: users.filter(u => u.role === 'employer').length, color: 'emerald' },
                      { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: 'amber' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-600">{item.label}</span>
                          <span className="font-bold text-slate-800">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className={`bg-${item.color}-600 h-2 rounded-full transition-all`}
                            style={{ width: `${(item.value / users.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-slate-600">{users.length} users registered</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-slate-600">{admins.length} admin accounts</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">User Management</h3>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">User</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Role</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Joined</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-600 text-sm">
                              {u.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{u.name}</p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            u.role === 'admin' ? 'bg-amber-50 text-amber-600' :
                            u.role === 'employer' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {u.role || 'candidate'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-5 text-right">
                          {u.role !== 'admin' && u.role !== 'employer' ? (
                            <button
                              onClick={() => handlePromoteToAdmin(u.id, u)}
                              className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                            >
                              Promote to Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRemoveAdmin(u.id)}
                              className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                            >
                              Remove Admin
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Admin Management</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {admins.map(admin => (
                  <div key={admin.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-bold text-lg">
                        {admin.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{admin.name}</h4>
                        <p className="text-xs text-slate-400">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        admin.role === 'superadmin' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {admin.role || 'employer'}
                      </span>
                      {admin.id !== user?.uid && (
                        <button
                          onClick={() => handleRemoveAdmin(admin.id)}
                          className="text-rose-400 hover:text-rose-600 transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3">
                      Assigned: {new Date(admin.assignedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}