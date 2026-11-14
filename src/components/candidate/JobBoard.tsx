import { useState, useEffect } from 'react';
import { collection, query, addDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../AuthProvider';
import { Briefcase, MapPin, Search, CheckCircle2, Zap, LogOut, Home, ChevronDown, Upload, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFile, scoreApplication } from '../../services/geminiService';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  department: string;
  status: string;
  createdAt: any;
}

export default function JobBoard({ onBackHome }: { onBackHome: () => void }) {
  const { user, login, logout } = useAuth();
  const [activeView, setActiveView] = useState<'all' | 'my-apps'>('all');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [viewingCV, setViewingCV] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [showCVInput, setShowCVInput] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubJobs = onSnapshot(q, (snapshot) => {
      const jobData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobData.filter(j => j.status === 'open'));
      setLoading(false);
    });

    let unsubApps = () => {};
    if (user) {
      const qApps = query(collection(db, 'applications'), orderBy('appliedAt', 'desc'));
      unsubApps = onSnapshot(qApps, (snapshot) => {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMyApplications(apps.filter((a: any) => a.candidateId === user.uid));
      });
    }

    return () => { unsubJobs(); unsubApps(); };
  }, [user]);

  const handleApply = async () => {
    if (!user) {
      await login();
      return;
    }
    if (!selectedJob) return;

    if (!showCVInput) {
      setShowCVInput(true);
      return;
    }

    if (!resumeText.trim() && !resumeFile) return;

    setApplying(true);
    setFileParsing(true);
    try {
      let analysisData = null;
      let resumeBase64 = '';

      // 1. Process via Server if file is present
      if (resumeFile) {
        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('jobDescription', selectedJob.description);
        formData.append('candidateId', user.uid);
        formData.append('userName', user.displayName || '');
        formData.append('userEmail', user.email || '');

        const response = await fetch('/api/applications/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Failed to process CV');
        
        const result = await response.json();
        analysisData = {
          analysis: result.analysis,
          scoring: result.scoring,
          fileName: result.fileName,
          resumeBase64: result.resumeBase64
        };
        resumeBase64 = result.resumeBase64;
      } else {
        // Fallback for text-only application
        const candidateProfile = { resumeText };
        analysisData = {
          analysis: { summary: resumeText },
          scoring: await scoreApplication(selectedJob.description, candidateProfile),
          fileName: 'inline-resume.txt'
        };
      }

      const { analysis, scoring } = analysisData;

      await addDoc(collection(db, 'applications'), {
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        jobCreatedBy: (selectedJob as any).createdBy || "",
        candidateId: user.uid,
        candidateName: user.displayName || analysis?.fullName || 'Anonymous',
        candidateEmail: user.email || analysis?.email || '',
        resumeText: resumeText || analysis?.summary || "",
        resumeBase64: resumeBase64, // Stored safely in Firestore
        fileName: resumeFile?.name || "resume.txt",
        status: scoring ? 'reviewed' : 'pending',
        score: scoring?.score || 0,
        matchAnalysis: scoring || null,
        aiAnalysis: analysis || null, // Store extracted profile info
        appliedAt: serverTimestamp(),
        createdBy: (selectedJob as any).createdBy || "" 
      });

      setApplicationSuccess(true);
      setTimeout(() => {
        setApplicationSuccess(false);
        setSelectedJob(null);
        setShowCVInput(false);
        setResumeText('');
        setResumeFile(null);
      }, 3000);
    } catch (err) {
      console.error(err);
      alert("Application failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setApplying(false);
      setFileParsing(false);
    }
  };

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBackHome}>
          <Zap className="text-indigo-600 w-6 h-6 fill-indigo-600" />
          <span className="font-bold text-xl tracking-tight text-slate-800">SmartHire AI</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                  {user.displayName?.[0] || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</p>
                  <p className="text-[10px] text-slate-400 font-medium tracking-tight">Candidate</p>
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
                      <button onClick={onBackHome} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left font-medium">
                        <Home className="w-4 h-4" />
                        Home Page
                      </button>
                      <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={() => login()} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Sign In</button>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Career Opportunities</h1>
          <div className="flex gap-4 mt-4">
             <button 
              onClick={() => setActiveView('all')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${activeView === 'all' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent'}`}
             >
                Explore Roles
             </button>
             {user && (
               <button 
                onClick={() => setActiveView('my-apps')}
                className={`text-sm font-bold pb-2 border-b-2 transition-all ${activeView === 'my-apps' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent'}`}
               >
                  My Applications ({myApplications.length})
               </button>
             )}
          </div>
        </div>
        {activeView === 'all' && (
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search roles or departments..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-full w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'all' ? (
          <motion.div 
            key="jobs" 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredJobs.map((job) => (
              <motion.div 
                layout
                key={job.id}
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex-1">
                  <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded mb-3">
                    {job.department}
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{job.title}</h3>
                  <div className="flex items-center text-slate-500 text-sm gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      Full-time
                    </div>
                  </div>
                </div>
                <button className="w-full mt-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
                  View Details
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="apps" 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {myApplications.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                <p className="text-slate-400 font-medium">You haven't applied to any roles yet.</p>
              </div>
            ) : (
              myApplications.map(app => (
                <div 
                  key={app.id} 
                  className="bg-white border border-slate-100 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{app.jobTitle}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                      Applied on {app.appliedAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center md:text-right">
                       <p className="text-[10px] uppercase font-black text-slate-400 mb-1">AI Match Score</p>
                       <div className={`text-lg font-black ${app.score ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {app.score ? `${app.score}%` : 'TBD'}
                       </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      app.status === 'shortlisted' ? 'bg-emerald-50 text-emerald-600' :
                      app.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {app.status}
                    </span>
                    <button 
                      onClick={() => setSelectedApp(app)}
                      className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100"
                    >
                      View Feedback
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedApp && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedApp(null)}
          >
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               className="bg-white max-w-2xl w-full rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
               onClick={(e) => e.stopPropagation()}
             >
                <div className="p-8 border-b border-slate-50 flex justify-between items-start">
                   <div>
                      <h2 className="text-2xl font-bold text-slate-900">Application Feedback</h2>
                      <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">For: {selectedApp.jobTitle}</p>
                   </div>
                   <button onClick={() => setSelectedApp(null)} className="text-slate-400 text-3xl font-light leading-none hover:text-slate-900">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/20">
                  {selectedApp.matchAnalysis ? (
                    <div className="space-y-8">
                      <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24">
                           <svg className="w-full h-full transform -rotate-90">
                              <circle cx="48" cy="48" r="44" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                              <circle cx="48" cy="48" r="44" stroke="#4f46e5" strokeWidth="8" fill="none" 
                                      strokeDasharray={276} strokeDashoffset={276 - (276 * (selectedApp.score / 100))} strokeLinecap="round" />
                           </svg>
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xl font-black text-slate-800">{selectedApp.score}%</span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase">Score</span>
                           </div>
                        </div>
                        <div className="flex-1">
                           <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1">AI Recommendation</h4>
                           <p className="text-sm text-slate-600 leading-relaxed font-medium">
                             {selectedApp.matchAnalysis.summary}
                           </p>
                        </div>
                      </div>

                      {selectedApp.aiAnalysis?.skills && (
                        <section>
                           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Extracted Skills</h4>
                           <div className="flex flex-wrap gap-2 text-[10px]">
                              {selectedApp.aiAnalysis.skills.map((s: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-white border border-slate-100 rounded-full font-bold text-slate-600 shadow-sm">
                                  {s}
                                </span>
                              ))}
                           </div>
                        </section>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100/50">
                            <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-3">Strengths</h4>
                            <ul className="text-xs text-emerald-800 space-y-2">
                               {selectedApp.matchAnalysis.strengths?.map((s: string, i: number) => <li key={i} className="flex gap-2"><span>•</span> {s}</li>)}
                            </ul>
                         </div>
                         <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100/50">
                            <h4 className="text-[10px] font-black text-rose-600 uppercase mb-3">To Improve</h4>
                            <ul className="text-xs text-rose-800 space-y-2">
                               {selectedApp.matchAnalysis.weaknesses?.map((w: string, i: number) => <li key={i} className="flex gap-2"><span>•</span> {w}</li>)}
                            </ul>
                         </div>
                      </div>

                      {selectedApp.resumeBase64 && (
                        <button 
                          onClick={() => setViewingCV(selectedApp.resumeBase64)}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
                        >
                          <FileText className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                          View Uploaded CV
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-20 text-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <Zap className="w-8 h-8 text-slate-300" />
                       </div>
                       <p className="text-slate-400 font-medium italic">Our AI team is still reviewing your application. Check back shortly!</p>
                    </div>
                  )}
                </div>
                
                <div className="p-8 border-t border-slate-50">
                  <button 
                    onClick={() => setSelectedApp(null)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    Alright, Got It
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingCV && (
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 md:p-10"
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

      <AnimatePresence>
        {selectedJob && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedJob.title}</h2>
                  <p className="text-indigo-600 font-bold uppercase text-[10px] tracking-widest mt-1">{selectedJob.department} • {selectedJob.location}</p>
                </div>
                <button onClick={() => setSelectedJob(null)} className="text-slate-300 hover:text-slate-900 text-3xl font-light leading-none">&times;</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                <div className="prose prose-slate max-w-none mb-8">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Job Responsibilities & Description</h4>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">{selectedJob.description}</p>
                </div>

                {showCVInput && !applicationSuccess && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-8 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Upload CV (PDF preferred)</label>
                        <div className={`relative border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center text-center ${resumeFile ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400'}`}>
                           <input 
                             type="file" 
                             className="absolute inset-0 opacity-0 cursor-pointer" 
                             accept=".pdf,.doc,.docx,.xlsx,.xls,image/*"
                             onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                           />
                           {resumeFile ? (
                             <>
                               <FileText className="w-10 h-10 text-indigo-500 mb-3" />
                               <p className="text-sm font-bold text-slate-800">{resumeFile.name}</p>
                               <p className="text-xs text-slate-500 mt-1">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                               <button 
                                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); setResumeFile(null); }}
                                 className="mt-4 text-xs font-black uppercase text-rose-500 flex items-center gap-1"
                               >
                                 <X className="w-3 h-3" /> Remove
                               </button>
                             </>
                           ) : (
                             <>
                               <Upload className="w-10 h-10 text-slate-300 mb-3" />
                               <p className="text-sm font-bold text-slate-600">Click or drag your CV here</p>
                               <p className="text-[10px] text-slate-400 mt-2">Supports PDF, DOCX, XLSX, and Images</p>
                             </>
                           )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">OR Paste Content</label>
                        <textarea 
                          className="w-full p-6 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-[200px] text-sm font-mono text-slate-600 bg-white shadow-inner"
                          placeholder="Include your experience, skills, and education details here..."
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="mt-6 text-[10px] text-slate-400 font-medium italic text-center">Our AI will analyze your provided credentials to match you with this role.</p>
                  </motion.div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-white">
                {applicationSuccess ? (
                  <div className="bg-emerald-50 text-emerald-700 p-6 rounded-3xl flex items-center gap-4 border border-emerald-100 shadow-sm">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                       <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">Application successfully sent!</p>
                      <p className="text-xs text-emerald-600 opacity-80">Our HR team will be in touch soon.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedJob(null)}
                      className="flex-1 py-4 border border-slate-100 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={applying || fileParsing || (showCVInput && !resumeText.trim() && !resumeFile)}
                      onClick={handleApply}
                      className="flex-3 py-4 bg-indigo-600 text-white rounded-2xl font-extrabold hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-indigo-100"
                    >
                      {applying ? (fileParsing ? 'Analyzing CV...' : 'Uploading...') : !showCVInput ? 'Apply for this Role' : 'Submit My Application'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
  );
}
