import { useState, useEffect } from 'react';
import { useAuth } from './components/AuthProvider';
import { useToast } from './components/ToastContext';
import { 
  ChevronRight, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  LogIn, 
  Briefcase, 
  UserCircle, 
  Building2, 
  Loader2,
  LayoutDashboard,
  Home,
  User,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JobBoard from './components/candidate/JobBoard';
import HRDashboard from './components/hr/HRDashboard';
import AdminDashboard from './components/admin/AdminDashboard';

export default function App() {
  const { user, isAdmin, isSuperAdmin, userRole, loading, isRegistering, login, loginEmail, registerEmail, logout, makeMeAdmin } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<'home' | 'candidate' | 'hr' | 'admin'>('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registerType, setRegisterType] = useState<'candidate' | 'employer'>('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (isRegistering) return;
    
    try {
      if (authMode === 'login') {
        await loginEmail(email, password);
        showToast('success', 'Welcome back! Successfully logged in.');
        setShowAuthModal(false);
        // Determine where to redirect based on user role
        if (isAdmin || userRole === 'employer') {
          setView('hr');
        } else {
          setView('candidate');
        }
      } else {
        // Register
        await registerEmail(email, password, name, registerType);
        showToast('success', `Account created successfully! Welcome to SmartHire AI as ${registerType}.`);
        setShowAuthModal(false);
        
        // Check the role after registration
        if (registerType === 'employer') {
          setView('hr');
        } else {
          setView('candidate');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
      showToast('error', err.message || 'Authentication failed');
    }
  };

  // Auto-redirect based on role after auth state changes
  useEffect(() => {
    if (user && !loading) {
      console.log('👤 User role:', userRole);
      console.log('📊 Current view:', view);
      
      // If user is on home page, redirect to appropriate dashboard
      if (view === 'home') {
        if (isSuperAdmin) {
          setView('admin');
        } else if (isAdmin || userRole === 'employer') {
          setView('hr');
        } else {
          setView('candidate');
        }
      }
    }
  }, [user, userRole, isAdmin, isSuperAdmin, loading]);

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initializing SmartHire AI...</p>
      </div>
    </div>
  );

  // Render appropriate dashboard
  if (view === 'candidate' && user) {
    return <JobBoard onBackHome={() => setView('home')} />;
  }

  if (view === 'hr' && (isAdmin || userRole === 'employer')) {
    return <HRDashboard onBackHome={() => setView('home')} />;
  }

  if (view === 'admin' && isSuperAdmin) {
    return <AdminDashboard onBackHome={() => setView('home')} />;
  }

  // Home page with navigation
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-6 py-3 md:py-4 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <Zap className="text-indigo-600 w-6 h-6 fill-indigo-600" />
            <span className="font-bold text-xl tracking-tight hidden sm:block">SmartHire AI</span>
            <span className="font-bold text-xl tracking-tight sm:hidden">SH</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#compliance" className="hover:text-slate-900 transition-colors">Compliance</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Enterprise</a>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {user ? (
              <div className="flex items-center gap-3 md:gap-4">
                {/* Dashboard Button - Shows appropriate dashboard based on role */}
                <button 
                  onClick={() => {
                    if (isSuperAdmin) {
                      setView('admin');
                    } else if (isAdmin || userRole === 'employer') {
                      setView('hr');
                    } else {
                      setView('candidate');
                    }
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  <LayoutDashboard className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">
                    {isSuperAdmin ? 'Admin' : isAdmin || userRole === 'employer' ? 'HR' : 'Jobs'} Dashboard
                  </span>
                  <span className="sm:hidden">Dashboard</span>
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 hover:bg-slate-50 transition-colors px-2 py-1 rounded-full"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 text-sm">
                      {user.displayName?.[0] || user.email?.[0] || 'U'}
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-slate-700">
                      {user.displayName?.split(' ')[0] || 'User'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20"
                        >
                          {/* User Info */}
                          <div className="px-4 py-3 border-b border-slate-100">
                            <p className="font-bold text-slate-900 text-sm">{user.displayName}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              userRole === 'employer' ? 'bg-indigo-50 text-indigo-600' :
                              userRole === 'admin' ? 'bg-amber-50 text-amber-600' :
                              'bg-slate-50 text-slate-600'
                            }`}>
                              {userRole || 'candidate'}
                            </span>
                          </div>

                          {/* Navigation Items */}
                          <button 
                            onClick={() => {
                              setShowUserMenu(false);
                              setView('home');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Home className="w-4 h-4" />
                            Home
                          </button>

                          <button 
                            onClick={() => {
                              setShowUserMenu(false);
                              if (isSuperAdmin) {
                                setView('admin');
                              } else if (isAdmin || userRole === 'employer') {
                                setView('hr');
                              } else {
                                setView('candidate');
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                          </button>

                          <div className="border-t border-slate-100 my-1"></div>

                          <button 
                            onClick={() => {
                              setShowUserMenu(false);
                              logout();
                              showToast('info', 'You have been signed out.');
                              setView('home');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <LogIn className="w-4 h-4" />
                            Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <LogIn className="w-4 h-4" /> 
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <button 
                    onClick={() => setShowAuthModal(false)} 
                    className="text-slate-400 hover:text-slate-600 font-bold"
                    disabled={isRegistering}
                  >
                    &times;
                  </button>
                </div>

                {authMode === 'register' ? (
                  <div className="mb-6">
                    <p className="text-sm text-slate-500 font-medium mb-4">Choose your account type:</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        type="button"
                        onClick={() => setRegisterType('candidate')}
                        disabled={isRegistering}
                        className={`p-4 rounded-2xl border-2 transition-all text-center ${
                          registerType === 'candidate' 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-slate-200 hover:border-indigo-200'
                        } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <UserCircle className={`w-8 h-8 mx-auto mb-2 ${registerType === 'candidate' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <p className={`font-bold text-sm ${registerType === 'candidate' ? 'text-indigo-600' : 'text-slate-600'}`}>Candidate</p>
                        <p className="text-[10px] text-slate-400 mt-1">Find jobs & apply</p>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setRegisterType('employer')}
                        disabled={isRegistering}
                        className={`p-4 rounded-2xl border-2 transition-all text-center ${
                          registerType === 'employer' 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-slate-200 hover:border-indigo-200'
                        } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Building2 className={`w-8 h-8 mx-auto mb-2 ${registerType === 'employer' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <p className={`font-bold text-sm ${registerType === 'employer' ? 'text-indigo-600' : 'text-slate-600'}`}>Employer</p>
                        <p className="text-[10px] text-slate-400 mt-1">Post jobs & hire</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-center text-sm text-slate-500 font-medium">
                      Sign in to your existing account
                    </p>
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Full Name</label>
                      <input 
                        required 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        type="text" 
                        disabled={isRegistering}
                        className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50" 
                        placeholder="John Doe" 
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Email Address</label>
                    <input 
                      required 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      type="email" 
                      disabled={isRegistering}
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50" 
                      placeholder="email@example.com" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Password</label>
                    <input 
                      required 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      type="password" 
                      disabled={isRegistering}
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50" 
                      placeholder="••••••••" 
                    />
                  </div>

                  {authError && <p className="text-rose-500 text-xs font-bold">{authError}</p>}

                  <button 
                    type="submit" 
                    disabled={isRegistering}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      authMode === 'login' ? 'Sign In' : `Register as ${registerType === 'candidate' ? 'Candidate' : 'Employer'}`
                    )}
                  </button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or continue with</span></div>
                </div>

                <button 
                  onClick={async () => {
                    try {
                      await login(registerType);
                      showToast('success', 'Successfully signed in with Google!');
                      setShowAuthModal(false);
                      if (registerType === 'employer') {
                        setView('hr');
                      } else {
                        setView('candidate');
                      }
                    } catch (err: any) {
                      showToast('error', err.message || 'Google login failed');
                    }
                  }}
                  disabled={isRegistering}
                  className="w-full py-4 border border-slate-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all mb-6 disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
                  Google Workspace
                </button>

                <p className="text-center text-sm text-slate-500 font-medium">
                  {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    disabled={isRegistering}
                    className="ml-2 text-indigo-600 font-bold hover:underline disabled:opacity-50"
                  >
                    {authMode === 'login' ? 'Register Now' : 'Sign In'}
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center md:text-left max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] uppercase font-black mb-6 border border-indigo-100">
              <Sparkles className="w-3 h-3" /> Powered by Gemini 3.1 Pro
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] mb-8 transition-all">
              HIRE SMARTER,<br />
              <span className="text-indigo-600">NOT HARDER.</span>
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed mb-10 max-w-2xl">
              An intelligent recruitment platform that ranks candidates using semantic AI matching, parses resumes with human accuracy, and eliminates bias automatically.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start">
              {user ? (
                <button 
                  onClick={() => {
                    if (isSuperAdmin) {
                      setView('admin');
                    } else if (isAdmin || userRole === 'employer') {
                      setView('hr');
                    } else {
                      setView('candidate');
                    }
                  }}
                  className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  Get Started
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <img key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i*123}`} alt="avatar" />
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600">+50k</div>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[800px] h-[800px] bg-slate-50 rounded-full -z-10 opacity-60"></div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">The AI Advantage</h2>
            <div className="w-12 h-1 bg-indigo-600"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Bias-Free Ranking</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Our AI analyzes candidates based on skills and impact, automatically stripping away gendered or demographic indicators that trigger unconscious bias.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Semantic Matching</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Move beyond keyword matching. Our system understands the context of a candidate's experience relative to your specific JD.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Instant Insights</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Get a comprehensive scorecard for every application, detailing strengths, weaknesses, and a qualitative match rationale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Selection / Role Selector */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[40px] p-12 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
             <Zap className="w-64 h-64" />
          </div>
          <h2 className="text-3xl font-bold mb-6">Experience the future of hiring today</h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto font-medium">
            SmartHire AI provides two distinct interfaces customized for every stakeholder in the recruitment lifecycle.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <button 
              onClick={() => {
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                setView('candidate');
              }}
              className="group flex flex-col items-center text-center p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UserCircle className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">Candidate Portal</h4>
              <p className="text-xs text-slate-400">Apply for roles, get matched by AI, and track status.</p>
            </button>
            <button 
              onClick={() => {
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                if (isAdmin || userRole === 'employer') {
                  setView('hr');
                } else {
                  showToast('info', 'Please sign up as an employer to access HR features.');
                  setShowAuthModal(true);
                }
              }}
              className="group flex flex-col items-center text-center p-8 bg-indigo-600 rounded-3xl hover:bg-indigo-700 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">HR & Admin Panel</h4>
              <p className="text-xs text-indigo-100/60">Rank applicants, see bias reports, and job analytics.</p>
            </button>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 flex flex-col items-center gap-4 text-slate-400">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 fill-slate-300 text-slate-300" />
          <span className="font-bold text-slate-600">SmartHire AI</span>
        </div>
        <p className="text-xs font-medium uppercase tracking-widest">Enterprise Recruitment Intelligence • 2026</p>
      </footer>
    </div>
  );
}