import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../AuthProvider';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Clock, 
  Star,
  ChevronRight,
  Filter,
  BarChart3,
  Home,
  LogOut,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFile, scoreApplication, detectJDBias } from '../../services/geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  resumeText?: string;
  resumeUrl?: string;
  resumeBase64?: string;
  fileName?: string;
  status: string;
  score?: number;
  matchAnalysis?: any;
  aiAnalysis?: any;
  appliedAt: any;
}

interface Job {
  id: string;
  title: string;
  department: string;
  status: string;
  description: string;
  createdAt: any;
}

export default function HRDashboard({ onBackHome }: { onBackHome: () => void }) {
  const { user, isSuperAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'applications'>('overview');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [newJob, setNewJob] = useState({ title: '', department: '', location: 'Remote', description: '' });
  const [showAddJob, setShowAddJob] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedJobView, setSelectedJobView] = useState<Job | null>(null);
  const [viewingCV, setViewingCV] = useState<string | null>(null);
  const [processingApp, setProcessingApp] = useState<string | null>(null);
  const [filterHighScore, setFilterHighScore] = useState(false);
  const [sortByDate, setSortByDate] = useState(true);

  // New application processing state
  const [parsingData, setParsingData] = useState(false);

  useEffect(() => {
    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubJobs = onSnapshot(qJobs, (doc) => {
      const allJobs = doc.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      setJobs(isSuperAdmin ? allJobs : allJobs.filter(j => (j as any).createdBy === user?.uid));
    });

    const qApps = query(collection(db, 'applications'), orderBy('appliedAt', 'desc'));
    const unsubApps = onSnapshot(qApps, (doc) => {
      const allApps = doc.docs.map(d => ({ id: d.id, ...d.data() } as Application));
      setApplications(isSuperAdmin ? allApps : allApps.filter(a => (a as any).createdBy === user?.uid || (a as any).jobCreatedBy === user?.uid));
    });

    return () => { unsubJobs(); unsubApps(); };
  }, [user, isSuperAdmin]);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Bias check on JD
    const biasReport = await detectJDBias(newJob.description);
    
    await addDoc(collection(db, 'jobs'), {
      ...newJob,
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      biasReport
    });
    setNewJob({ title: '', department: '', location: 'Remote', description: '' });
    setShowAddJob(false);
  };

  const handleCloseJob = async (jobId: string, currentStatus: string) => {
    if (!confirm(`Are you sure you want to ${currentStatus === 'open' ? 'close' : 'open'} this job?`)) return;
    try {
      await updateDoc(doc(db, 'jobs', jobId), {
        status: currentStatus === 'open' ? 'closed' : 'open'
      });
    } catch (err) {
      console.error("Error updating job:", err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this job posting? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      // Optionally delete associated applications too? Usually safer to keep them or archive.
    } catch (err) {
      console.error("Error deleting job:", err);
    }
  };

  const handleAnalyzeApplication = async (app: Application) => {
    setProcessingApp(app.id);
    try {
      const job = jobs.find(j => j.id === app.jobId);
      if (!job) return;

      let fileData = null;
      // If no text but has URL and is PDF/Image, try to parse file
      if (!app.resumeText && app.resumeUrl) {
        try {
          const response = await fetch(app.resumeUrl);
          const blob = await response.blob();
          if (blob.type === 'application/pdf' || blob.type.startsWith('image/')) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            const base64Data = await base64Promise;
            fileData = await analyzeFile(base64Data, blob.type);
          }
        } catch (fetchErr) {
          console.warn("Could not fetch file for automatic analysis", fetchErr);
        }
      }

      const analysis = await scoreApplication(job.description, {
        name: app.candidateName,
        email: app.candidateEmail,
        resumeText: app.resumeText || "No resume text provided.",
        ...(fileData || {})
      });

      await updateDoc(doc(db, 'applications', app.id), {
        score: analysis.score,
        matchAnalysis: analysis,
        aiAnalysis: fileData || null,
        status: 'reviewed',
        ...(fileData ? { candidateName: fileData.fullName, candidateEmail: fileData.email } : {})
      });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingApp(null);
    }
  };

  const stats = [
    { label: isSuperAdmin ? 'Global Postings' : 'My Postings', value: jobs.length, icon: Briefcase, color: 'indigo' },
    { label: isSuperAdmin ? 'Global Apps' : 'My Applicants', value: applications.length, icon: Users, color: 'emerald' },
    { label: 'Avg Quality Score', value: (applications.reduce((acc, a) => acc + (a.score || 0), 0) / (applications.filter(a => a.score).length || 1)).toFixed(1), icon: Star, color: 'amber' },
    { label: 'Bias Alerts', value: jobs.filter(j => (j as any).biasReport?.hasBias).length, icon: AlertCircle, color: 'rose' },
  ];

  const chartData = jobs.map(j => ({
    name: j.title.substring(0, 10) + '...',
    apps: applications.filter(a => a.jobId === j.id).length
  }));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">SmartHire AI</span>
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'jobs', label: 'Active Postings', icon: Briefcase },
              { id: 'applications', label: 'Candidate Feed', icon: Users },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-slate-100 italic text-xs text-slate-400">
          Powered by Gemini 3.1 Pro
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
                  <p className="text-[10px] uppercase text-indigo-500 font-bold tracking-widest">HR Administrator</p>
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
                      <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> +12%
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-80">
                  <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Applications per Role</h3>
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
                      <YAxis fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="apps" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Candidate Quality Distribution</h3>
                  <div className="flex items-center justify-center p-4">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                        <circle cx="80" cy="80" r="70" stroke="#4f46e5" strokeWidth="12" fill="none" 
                                strokeDasharray={440} strokeDasharray-offset={440 - (440 * (Number(stats[2].value)/100))} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-800">{stats[2].value}%</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Score</span>
                      </div>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-3">
                    <li className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> High Match</span>
                      <span className="font-bold text-slate-700">65%</span>
                    </li>
                    <li className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-300"></div> Developing</span>
                      <span className="font-bold text-slate-700">24%</span>
                    </li>
                    <li className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-100"></div> Low Match</span>
                      <span className="font-bold text-slate-700">11%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'jobs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Job Catalog</h3>
                  <p className="text-sm text-slate-500">Manage and monitor your open requisitions.</p>
                </div>
                <button 
                  onClick={() => setShowAddJob(true)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Posting
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {jobs.map(job => {
                  const jobApps = applications.filter(a => a.jobId === job.id);
                  return (
                    <div key={job.id} className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:border-indigo-200 transition-all gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                          <Briefcase className={`w-5 h-5 ${job.status === 'open' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{job.title}</h4>
                          <p className="text-sm text-slate-500">{job.department} • {(job as any).location || 'Remote'}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-6">
                         <button 
                          onClick={() => setSelectedJobView(job)}
                          className="flex items-center gap-6 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all group"
                         >
                            <div className="text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Applicants</p>
                                <p className="font-black text-indigo-600 text-lg">{jobApps.length}</p>
                            </div>
                            <div className="text-right">
                               <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                 job.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                               }`}>
                                 {job.status}
                               </span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                         </button>

                         {(job as any).biasReport?.hasBias && (
                           <div className="group relative">
                              <AlertCircle className="text-rose-500 w-5 h-5 cursor-help" />
                               <div className="absolute bottom-full mb-2 right-0 w-64 p-3 bg-white border border-slate-100 shadow-xl rounded-xl text-xs invisible group-hover:visible transition-all z-20">
                                  <p className="font-bold text-rose-600 mb-1">Bias Detected!</p>
                                  <p className="text-slate-600">{(job as any).biasReport.biasDetails}</p>
                               </div>
                           </div>
                         )}

                         <div className="flex items-center gap-2 border-l border-slate-100 pl-6 ml-2">
                            <button 
                              onClick={() => handleCloseJob(job.id, job.status)}
                              className={`p-2 rounded-lg transition-all ${job.status === 'open' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                              title={job.status === 'open' ? 'Close Job' : 'Re-open Job'}
                            >
                               {job.status === 'open' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDeleteJob(job.id)}
                              className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                              title="Delete Job"
                            >
                               <X className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">Intelligent Candidate Ranking</h3>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => setFilterHighScore(!filterHighScore)}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${filterHighScore ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <Filter className="w-3.5 h-3.5" /> High Scores {filterHighScore ? '(On)' : 'Only'}
                      </button>
                      <button 
                        onClick={() => setSortByDate(!sortByDate)}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${!sortByDate ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <Clock className="w-3.5 h-3.5" /> {sortByDate ? 'Recent First' : 'Score Ranking'}
                      </button>
                   </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Candidate</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Applied Role</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Score</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {applications
                      .filter(app => !filterHighScore || (app.score && app.score >= 80))
                      .sort((a, b) => {
                        if (sortByDate) {
                          return (b.appliedAt?.seconds || 0) - (a.appliedAt?.seconds || 0);
                        }
                        return (b.score || 0) - (a.score || 0);
                      })
                      .map(app => (
                        <tr 
                          key={app.id} 
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedApp(app)}
                        >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center font-bold text-indigo-600 text-sm">
                              {app.candidateName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{app.candidateName}</p>
                                <p className="text-[10px] text-slate-400 mb-1">{app.candidateEmail}</p>
                                {app.aiAnalysis?.skills && (
                                  <div className="flex gap-1">
                                    {app.aiAnalysis.skills.slice(0, 3).map((s: string, i: number) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[8px] font-bold border border-slate-100">
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-slate-700">{app.jobTitle}</p>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-col items-center">
                              {app.score ? (
                                <div className={`px-2.5 py-1 rounded-lg text-sm font-black ${
                                  app.score >= 80 ? 'bg-emerald-50 text-emerald-600' : 
                                  app.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                   {app.score}%
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 font-bold">Pending AI</span>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full ${
                             app.status === 'reviewed' ? 'bg-indigo-50 text-indigo-600' :
                             app.status === 'shortlisted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                           }`}>
                             {app.status}
                           </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {app.resumeBase64 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setViewingCV(app.resumeBase64!); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="View CV"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            
                            {app.score ? (
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={processingApp === app.id}
                                  onClick={(e) => { e.stopPropagation(); handleAnalyzeApplication(app); }}
                                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-indigo-100"
                                >
                                  {processingApp === app.id ? '...' : 'Re-analyze'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
                                >
                                  View Details
                                </button>
                              </div>
                            ) : (
                              <button 
                                disabled={processingApp === app.id}
                                onClick={(e) => { e.stopPropagation(); handleAnalyzeApplication(app); }}
                                className="text-[10px] font-black uppercase tracking-wider px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                              >
                                {processingApp === app.id ? 'Processing...' : 'Run AI Match'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Add Job */}
      {showAddJob && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-xl overflow-hidden">
                <form onSubmit={handleAddJob} className="p-8">
                    <h2 className="text-2xl font-bold mb-6">Create New Job Posting</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Role Title</label>
                            <input required value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} type="text" className="w-full p-3 rounded-xl border border-slate-200 focus:outline-indigo-500" placeholder="e.g. Senior Frontend Engineer" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Department</label>
                                <input required value={newJob.department} onChange={e => setNewJob({...newJob, department: e.target.value})} type="text" className="w-full p-3 rounded-xl border border-slate-200 focus:outline-indigo-500" placeholder="e.g. Engineering" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Location</label>
                                <input required value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} type="text" className="w-full p-3 rounded-xl border border-slate-200 focus:outline-indigo-500" placeholder="e.g. London / Remote" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Job Description</label>
                            <textarea required value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} rows={6} className="w-full p-3 rounded-xl border border-slate-200 focus:outline-indigo-500" placeholder="Describe the role, responsibilities, and requirements..." />
                        </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button type="button" onClick={() => setShowAddJob(false)} className="flex-1 py-3 font-bold text-slate-400">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">Publish Posting</button>
                    </div>
                </form>
            </motion.div>
         </div>
      )}

      {/* Modal: Job Specific Applicants */}
      <AnimatePresence>
        {selectedJobView && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white rounded-[40px] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-indigo-600">
                <div>
                   <h2 className="text-2xl font-black text-white">{selectedJobView.title}</h2>
                   <p className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mt-1">
                     {selectedJobView.department} • {applications.filter(a => a.jobId === selectedJobView.id).length} Applicants
                   </p>
                </div>
                <button 
                  onClick={() => setSelectedJobView(null)} 
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {applications.filter(a => a.jobId === selectedJobView.id).length === 0 ? (
                  <div className="text-center py-20">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No candidates have applied for this role yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {applications
                      .filter(a => a.jobId === selectedJobView.id)
                      .sort((a, b) => (b.score || 0) - (a.score || 0))
                      .map(app => (
                        <div 
                          key={app.id}
                          className="p-5 border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer bg-white group"
                          onClick={() => {
                            setSelectedApp(app);
                            setSelectedJobView(null);
                          }}
                        >
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">
                                    {app.candidateName.split(' ').map(n => n[0]).join('')}
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{app.candidateName}</h4>
                                    <p className="text-[10px] text-slate-400 font-medium">{app.candidateEmail}</p>
                                 </div>
                              </div>
                              <div className={`px-2 py-1 rounded-lg text-xs font-black ${
                                app.score && app.score >= 80 ? 'bg-emerald-50 text-emerald-600' :
                                app.score && app.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {app.score ? `${app.score}%` : 'TBD'}
                              </div>
                           </div>
                           <div className="flex flex-wrap gap-1">
                              {app.aiAnalysis?.skills?.slice(0, 4).map((s: string, i: number) => (
                                 <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] font-bold border border-slate-100">
                                    {s}
                                 </span>
                              ))}
                           </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              
              <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
                 <p className="text-xs text-slate-400 font-medium italic">Click a candidate to view their AI-powered profile and resume.</p>
                 <button 
                  onClick={() => setSelectedJobView(null)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                 >
                   Close View
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-50 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black">
                   {selectedApp.candidateName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                   <h2 className="text-2xl font-extrabold text-slate-900">{selectedApp.candidateName}</h2>
                   <p className="text-indigo-600 font-bold uppercase text-[10px] tracking-widest">Applying for {selectedApp.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 {selectedApp.resumeBase64 && (
                    <button 
                      onClick={() => setViewingCV(selectedApp.resumeBase64!)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg"
                    >
                       <FileText className="w-4 h-4" /> View Full CV
                    </button>
                 )}
                 <button onClick={() => setSelectedApp(null)} className="text-slate-300 hover:text-slate-900 text-3xl font-light">&times;</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <section>
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">AI Match Score</h4>
                        <div className="flex items-end gap-3">
                           <span className="text-6xl font-black text-slate-800 tracking-tighter">{selectedApp.score || '--'}</span>
                           <span className="text-slate-400 font-bold mb-2">/ 100</span>
                        </div>
                     </section>

                     <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-800 mb-4">Semantic Analysis</h4>
                        <p className="text-slate-600 text-sm leading-relaxed italic mb-6">
                           {selectedApp.matchAnalysis?.summary || "Analysis pending..."}
                        </p>
                        
                        {selectedApp.aiAnalysis?.skills && (
                           <div className="pt-6 border-t border-slate-50">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Top Extracted Skills</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedApp.aiAnalysis.skills.map((s: string, i: number) => (
                                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100 shadow-sm transition-transform hover:scale-105">
                                    {s}
                                  </span>
                                ))}
                              </div>
                           </div>
                        )}
                     </section>

                     {selectedApp.aiAnalysis?.experience && (
                        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                           <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                             <Briefcase className="w-4 h-4 text-indigo-500" />
                             Professional Experience
                           </h4>
                           <div className="space-y-6">
                             {selectedApp.aiAnalysis.experience.map((exp: any, i: number) => (
                               <div key={i} className="relative pl-6 border-l-2 border-slate-100 last:border-0 pb-6 last:pb-0">
                                 <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-500" />
                                 <h5 className="font-bold text-slate-900 text-sm leading-none mb-1">{exp.role}</h5>
                                 <p className="text-xs font-bold text-indigo-600 mb-2">{exp.company} • {exp.duration}</p>
                                 <p className="text-xs text-slate-500 leading-relaxed">{exp.description}</p>
                               </div>
                             ))}
                           </div>
                        </section>
                     )}

                     {selectedApp.aiAnalysis?.education && (
                        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                           <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-emerald-500" />
                             Education & Certifications
                           </h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {selectedApp.aiAnalysis.education.map((edu: any, i: number) => (
                               <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                 <h5 className="font-bold text-slate-900 text-sm tracking-tight">{edu.degree}</h5>
                                 <p className="text-xs text-slate-500 mt-1">{edu.institution}</p>
                                 <p className="text-[10px] font-black text-indigo-500 mt-2">{edu.year}</p>
                               </div>
                             ))}
                           </div>
                        </section>
                     )}

                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                           <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-2">Strengths</h4>
                           <ul className="space-y-1">
                              {selectedApp.matchAnalysis?.strengths?.map((s: string, i: number) => (
                                <li key={i} className="text-xs text-emerald-800 flex items-start gap-2">• {s}</li>
                              ))}
                           </ul>
                        </div>
                        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                           <h4 className="text-[10px] font-black text-rose-600 uppercase mb-2">Weaknesses</h4>
                           <ul className="space-y-1">
                              {selectedApp.matchAnalysis?.weaknesses?.map((w: string, i: number) => (
                                <li key={i} className="text-xs text-rose-800 flex items-start gap-2">• {w}</li>
                              ))}
                           </ul>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <section className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Bias Detection Report</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                           {selectedApp.matchAnalysis?.biasCheck || "No bias analysis found."}
                        </p>
                     </section>

                     <section>
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Resume Content</h4>
                        <div className="flex flex-wrap gap-3 mb-4">
                           {selectedApp.resumeUrl ? (
                              <a 
                                href={selectedApp.resumeUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                              >
                                 <Download className="w-3.5 h-3.5" /> Download CV File
                              </a>
                           ) : selectedApp.resumeBase64 ? (
                              <button 
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = selectedApp.resumeBase64!;
                                  link.download = selectedApp.fileName || 'resume';
                                  link.click();
                                }}
                                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                              >
                                 <Download className="w-3.5 h-3.5" /> Download (Fallback)
                              </button>
                           ) : null}
                           <button 
                             onClick={() => {
                                const blob = new Blob([selectedApp.resumeText || ''], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `resume_${selectedApp.candidateName}.txt`;
                                a.click();
                             }}
                             className="flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all border border-slate-100"
                           >
                              <FileText className="w-3.5 h-3.5" /> Export Text
                           </button>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 font-mono text-[11px] text-slate-500 whitespace-pre-wrap max-h-64 overflow-y-auto shadow-inner">
                           {selectedApp.resumeText || "No text content provided."}
                        </div>
                     </section>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-white border-t border-slate-50 flex gap-4">
               <button 
                  onClick={async () => {
                     if (!selectedApp) return;
                     await updateDoc(doc(db, 'applications', selectedApp.id), { status: 'shortlisted' });
                     setSelectedApp({...selectedApp, status: 'shortlisted'});
                  }}
                  className={`flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all ${selectedApp?.status === 'shortlisted' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {selectedApp?.status === 'shortlisted' ? 'Candidate Shortlisted' : 'Shortlist Candidate'}
                </button>
                <button 
                  onClick={async () => {
                     if (!selectedApp) return;
                     await updateDoc(doc(db, 'applications', selectedApp.id), { status: 'rejected' });
                     setSelectedApp({...selectedApp, status: 'rejected'});
                  }}
                  className={`flex-1 py-4 border border-slate-100 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all ${selectedApp?.status === 'rejected' ? 'text-rose-600 border-rose-100 bg-rose-50' : ''}`}
                >
                  {selectedApp?.status === 'rejected' ? 'Rejected' : 'Reject Candidate'}
                </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CV Viewer Backdrop */}
      <AnimatePresence>
        {viewingCV && (
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-10"
            onClick={() => setViewingCV(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-5xl h-full rounded-3xl overflow-hidden flex flex-col relative shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10">
                 <button 
                  onClick={() => setViewingCV(null)}
                  className="w-10 h-10 bg-slate-900/10 hover:bg-slate-900/20 text-slate-900 rounded-full flex items-center justify-center backdrop-blur-md transition-all"
                 >
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <iframe 
                src={viewingCV} 
                className="w-full h-full border-none"
                title="CV Preview"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
