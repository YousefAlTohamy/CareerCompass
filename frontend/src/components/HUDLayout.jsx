import { Compass } from 'lucide-react';
import ProcessingAnimation from './ProcessingAnimation';
import { motion, AnimatePresence } from 'framer-motion';

export default function HUDLayout({ children, loading = false, loadingType = 'scanning' }) {
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm"
          >
            <div className="relative">
               <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
               <Compass className="text-indigo-600 dark:text-indigo-400 animate-spin-slow relative z-10" size={60} strokeWidth={1} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full h-full">
        {children}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}} />
    </div>
  );
}
