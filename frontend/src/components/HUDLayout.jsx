import { Compass } from 'lucide-react';
import ProcessingAnimation from './ProcessingAnimation';
import { motion, AnimatePresence } from 'framer-motion';

export default function HUDLayout({ children, loading = false, loadingType = 'standard' }) {
  return (
    <div className="relative w-full h-full">
      {/* Dynamic Background Noise */}
      <div className="noise-overlay fixed inset-0 opacity-[0.03] pointer-events-none z-0"></div>
      
      {/* Fluid Orbs */}
      <div className="fluid-bg-container fixed inset-0 pointer-events-none z-0">
        <div className="fluid-blob w-[800px] h-[800px] bg-indigo-500/10 dark:bg-indigo-500/20 top-[-20%] left-[-10%]" />
        <div className="fluid-blob w-[600px] h-[600px] bg-fuchsia-500/10 dark:bg-fuchsia-500/20 bottom-[-10%] right-[-5%]" />
      </div>

      <AnimatePresence>
        {loading && loadingType === 'scanning' && (
          <ProcessingAnimation isVisible={true} />
        )}
        
        {loading && loadingType === 'standard' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-slate-950/20 backdrop-blur-xl"
          >
            <div className="relative">
               <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
               <motion.div
                 animate={{ 
                   rotate: [0, 360],
                   scale: [0.95, 1.05, 0.95]
                 }}
                 transition={{ 
                   rotate: { repeat: Infinity, duration: 10, ease: "linear" },
                   scale: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                 }}
                 className="relative z-10 flex items-center justify-center"
               >
                 <Compass className="text-indigo-600 dark:text-indigo-400" size={80} strokeWidth={0.5} />
                 <div className="absolute w-20 h-20 border border-indigo-500/20 rounded-full animate-ping" />
               </motion.div>
               <div className="mt-8 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500 animate-pulse">Initializing Neural Link</div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full h-full">
        {children}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .fluid-bg-container { filter: blur(100px); }
        .fluid-blob { position: absolute; border-radius: 50%; mix-blend-mode: multiply; }
        .dark .fluid-blob { mix-blend-mode: screen; }
      `}} />
    </div>
  );
}

