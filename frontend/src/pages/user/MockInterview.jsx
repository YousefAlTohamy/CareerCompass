import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Mic, MicOff, Video, VideoOff, Play, Square, MessageSquare, 
  Activity, Sparkles, CheckCircle2, ChevronRight, ShieldCheck,
  BrainCircuit, Zap
} from 'lucide-react';
import HUDLayout from '../../components/HUDLayout';
import TypingEffect from '../../components/TypingEffect';
import GraduationDemoPreview from '../../components/GraduationDemoPreview';

export default function MockInterview() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [interviewState, setInterviewState] = useState('setup'); // setup, active, completed
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  
  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const startInterview = () => {
    setInterviewState('active');
    setMessages([
      { role: 'ai', text: t('mock_interview.intro_msg', "Hello! I'm your AI Interviewer. I've reviewed your profile. Let's start. Can you tell me about a recent challenging project you worked on?") }
    ]);
  };

  const endInterview = () => {
    setInterviewState('completed');
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!currentInput.trim()) return;
    
    const newMessages = [...messages, { role: 'user', text: currentInput }];
    setMessages(newMessages);
    setCurrentInput('');
    
    // Mock AI Response after a delay
    setTimeout(() => {
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: t('mock_interview.followup_msg', "That's very interesting. How did you handle the specific technical constraints in that situation?") }
      ]);
    }, 1500);
  };

  return (
    <HUDLayout loading={false} loadingType="standard">
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 space-y-8 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-fuchsia-500 mb-3">
              <BrainCircuit size={14} className="animate-pulse" /> {t('mock_interview.neural_engine', 'Interview Practice Preview')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              {t('mock_interview.title', 'AI Mock Interview')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t('mock_interview.subtitle', 'Preview a guided interview flow. Video analysis and scored reports are planned as future evaluated work.')}
            </p>
          </div>
        </div>

        <GraduationDemoPreview>
          {t('mock_interview.preview_note', 'The chat prompt flow is interactive, but camera/microphone analysis and final scoring are illustrative only.')}
        </GraduationDemoPreview>

        <AnimatePresence mode="wait">
          {interviewState === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="glass-card !rounded-3xl p-8 md:p-12 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-8 min-h-[600px]"
            >
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-pulse blur-xl" />
                <div className="relative w-full h-full glass-card !rounded-full border-indigo-500/30 flex items-center justify-center bg-white dark:bg-slate-900 shadow-2xl">
                  <Video size={64} className="text-indigo-500" />
                </div>
              </div>
              <div className="space-y-4 max-w-md mx-auto">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('mock_interview.ready', 'Ready to begin?')}</h2>
                <p className="text-slate-500 font-medium">{t('mock_interview.ready_desc', 'Use this preview to practice answer structure. It does not record or analyze real camera or microphone data yet.')}</p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setMicActive(!micActive)} className={`p-4 rounded-2xl transition-all ${micActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                  {micActive ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
                <button onClick={() => setCamActive(!camActive)} className={`p-4 rounded-2xl transition-all ${camActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                  {camActive ? <Video size={24} /> : <VideoOff size={24} />}
                </button>
                <button onClick={startInterview} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                  <Play size={20} /> {t('mock_interview.start', 'Start Session')}
                </button>
              </div>
            </motion.div>
          )}

          {interviewState === 'active' && (
            <motion.div 
              key="active"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="grid lg:grid-cols-12 gap-6 min-h-[600px]"
            >
              {/* VIDEO FEEDS */}
              <div className="lg:col-span-7 space-y-6 flex flex-col">
                <div className="relative flex-1 glass-card !rounded-3xl border-slate-200 dark:border-white/10 bg-slate-900 overflow-hidden min-h-[400px]">
                  {/* Mock AI Video */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/50 to-slate-900">
                      <motion.div 
                        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }} 
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"
                      />
                      <BrainCircuit size={100} className="text-indigo-400 opacity-50 relative z-10" strokeWidth={1} />
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-white font-black text-[10px] uppercase tracking-widest border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> {t('mock_interview.recording', 'REC')}
                  </div>
                  <div className="absolute bottom-4 right-4 w-48 h-32 bg-black border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Mock User Video Feed */}
                    {camActive ? (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
                        <UserIcon />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600">
                        <VideoOff size={24} />
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTROLS */}
                <div className="glass-card !rounded-2xl p-4 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl flex justify-center gap-4">
                  <button onClick={() => setMicActive(!micActive)} className={`p-4 rounded-xl transition-all ${micActive ? 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white' : 'bg-rose-500/10 text-rose-500'}`}>
                    {micActive ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button onClick={() => setCamActive(!camActive)} className={`p-4 rounded-xl transition-all ${camActive ? 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white' : 'bg-rose-500/10 text-rose-500'}`}>
                    {camActive ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                  <button onClick={endInterview} className="px-6 py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-700 transition-all">
                    <Square size={16} /> {t('mock_interview.end', 'End Session')}
                  </button>
                </div>
              </div>

              {/* TRANSCRIPT & CHAT */}
              <div className="lg:col-span-5 glass-card !rounded-3xl border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col h-[600px] lg:h-auto overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs">{t('mock_interview.transcript', 'Practice Transcript')}</h3>
                  </div>
                  <Activity size={18} className="text-emerald-500 animate-pulse" />
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-start">
                  {messages.map((msg, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                      key={idx} 
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-1">
                        {msg.role === 'user' ? t('mock_interview.you', 'You') : t('mock_interview.ai_interviewer', 'AI Interviewer')}
                      </span>
                      <div className={`p-4 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white rounded-bl-sm border border-slate-200 dark:border-white/5'}`}>
                        {msg.role === 'ai' && idx === messages.length - 1 ? (
                          <TypingEffect text={msg.text} speed={20} />
                        ) : (
                          <p className="text-sm font-medium">{msg.text}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                  <form onSubmit={handleSend} className="relative">
                    <input 
                      type="text" 
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder={t('mock_interview.type_answer', 'Type your answer...')}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white pe-12"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors rtl:left-2 rtl:right-auto">
                      <MessageSquare size={18} />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {interviewState === 'completed' && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card !rounded-3xl p-8 md:p-12 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl text-start"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">{t('mock_interview.session_complete', 'Session Complete')}</h2>
                  <p className="text-slate-500 font-medium">{t('mock_interview.report_ready', 'Your practice summary is ready.')}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="glass-card !rounded-2xl p-6 border-indigo-500/20 bg-indigo-500/5 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">{t('mock_interview.overall_score', 'Overall Score')}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">Preview</span>
                </div>
                <div className="glass-card !rounded-2xl p-6 border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">{t('mock_interview.communication', 'Communication')}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">Not scored</span>
                </div>
                <div className="glass-card !rounded-2xl p-6 border-amber-500/20 bg-amber-500/5 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">{t('mock_interview.technical', 'Technical Depth')}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">Not scored</span>
                </div>
              </div>

              <div className="space-y-6 bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-slate-200 dark:border-white/5">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Sparkles className="text-indigo-500" size={20} /> Practice Feedback</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  This preview captured your typed practice answers. A future evaluated version should score clarity, technical depth, examples, and role alignment before this page presents real interview analytics.
                </p>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setInterviewState('setup')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <RefreshCwIcon /> {t('mock_interview.try_again', 'Try Again')}
                  </button>
                  <button disabled className="px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest cursor-not-allowed">
                    {t('mock_interview.download_report', 'Download Report')} · Planned
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 4px; }
      `}} />
    </HUDLayout>
  );
}

// Icons
function UserIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function RefreshCwIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
}
