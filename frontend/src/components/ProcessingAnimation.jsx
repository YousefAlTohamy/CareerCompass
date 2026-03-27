import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
 
export default function ProcessingAnimation({ isVisible, message = "Scanning document..." }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 font-sans no-print"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            className="bg-slate-900/80 backdrop-blur-2xl p-10 shadow-2xl border border-white/10 max-w-sm w-full text-center relative overflow-hidden rounded-[2.5rem]"
          >
            {/* Background Decorative Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            {/* Visuals - SCANNING CONCEPT */}
            <div className="relative mb-8">
              {/* The indigo scanning container */}
              <div className="w-24 h-32 bg-slate-950/50 border border-white/5 rounded-2xl flex items-center justify-center mx-auto relative overflow-hidden shadow-inner p-4">
                
                {/* The Document Icon */}
                <FileText className="text-indigo-400 opacity-80" size={48} strokeWidth={1} />
                
                {/* The Scan Line (Animated UP and DOWN) */}
                <motion.div 
                   className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_15px_#6366f1,0_0_5px_white]"
                   initial={{ top: '10%' }}
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2, 
                    ease: "easeInOut" 
                  }}
                />
                
                {/* Small pulsing sparkles inside */}
                <motion.div
                    className="absolute bottom-2 right-2 text-fuchsia-400"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                    <Wand2 size={16} />
                </motion.div>
              </div>
            </div>
 
            {/* Text */}
            <div className="space-y-2 relative z-10">
              <h3 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="text-fuchsia-400" size={20}/>
                {t('cv_analyzer.processing_title', 'AI Engine')}
              </h3>
              <p className="text-sm font-bold text-slate-400 leading-relaxed px-4">
                {message}
              </p>
            </div>
 
            {/* Animated Loading Bar */}
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-8 relative border border-white/5">
              <motion.div
                className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 rounded-full"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
            </div>
 
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
