import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Cpu, Scan, CheckCircle2 } from 'lucide-react';

const ProcessingAnimation = ({ isVisible, message = "Analyzing Resume..." }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const increment = Math.random() * 5;
          return Math.min(prev + increment, 98);
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95 backdrop-blur-sm"
        >
          <div className="max-w-md w-full p-8 text-center space-y-8">
            {/* Resume Skeleton Container */}
            <div className="relative w-48 h-64 bg-white/10 rounded-xl mx-auto border border-white/20 overflow-hidden shadow-2xl">
              {/* Fake Text Lines */}
              <div className="p-6 space-y-4">
                <div className="h-2 w-1/2 bg-white/20 rounded-full" />
                <div className="h-2 w-full bg-white/10 rounded-full" />
                <div className="h-2 w-full bg-white/10 rounded-full" />
                <div className="h-2 w-3/4 bg-white/10 rounded-full" />
                <div className="pt-4 space-y-2">
                  <div className="h-2 w-full bg-white/10 rounded-full" />
                  <div className="h-2 w-full bg-white/10 rounded-full" />
                </div>
              </div>

              {/* Scanning Laser */}
              <motion.div
                animate={{ 
                  top: ["0%", "90%", "0%"],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_15px_#00d4ff] z-10"
              />

              {/* Glow Effect where Laser hits */}
              <motion.div 
                animate={{ 
                  top: ["0%", "90%", "0%"],
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-x-0 h-20 bg-accent/5 blur-xl pointer-events-none"
              />
            </div>

            {/* Status Text & Progress */}
            <div className="space-y-4">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center justify-center gap-3"
              >
                <Cpu className="text-accent animate-spin-slow" size={24} />
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {message}
                </h2>
              </motion.div>

              <div className="w-full bg-white/10 rounded-full h-2 max-w-[200px] mx-auto overflow-hidden">
                <motion.div
                  className="bg-accent h-full shadow-[0_0_10px_#00d4ff]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              
              <p className="text-slate-400 text-sm font-medium">
                AI Engines: <span className="text-white">{Math.round(progress)}% Complete</span>
              </p>
            </div>

            {/* Quick Insights List */}
            <div className="flex justify-center gap-6">
               <div className="flex flex-col items-center gap-2">
                  <Scan size={18} className="text-accent" />
                  <span className="text-[10px] text-slate-300 uppercase font-bold tracking-widest">Parsing Structure</span>
               </div>
               <div className="flex flex-col items-center gap-2">
                  <FileText size={18} className="text-accent" />
                  <span className="text-[10px] text-slate-300 uppercase font-bold tracking-widest">Extracting Skills</span>
               </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProcessingAnimation;
