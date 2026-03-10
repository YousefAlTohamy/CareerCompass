import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, Wand2 } from 'lucide-react';

export default function ProcessingAnimation({ isVisible, message = "Scanning document..." }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans no-print"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            className="bg-white rounded-3xl p-10 shadow-2xl border border-slate-100 max-w-sm w-full text-center relative overflow-hidden"
          >
            {/* Visuals - SCANNING CONCEPT */}
            <div className="relative mb-8">
              {/* The indigo scanning container */}
              <div className="w-24 h-32 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto relative overflow-hidden shadow-inner p-4">
                
                {/* The Document Icon */}
                <FileText className="text-indigo-600" size={48} strokeWidth={1.5} />
                
                {/* The Scan Line (Animated UP and DOWN) */}
                <motion.div 
                  className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_#6366f1]"
                  initial={{ top: '10%' }}
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2.2, 
                    ease: "easeInOut" 
                  }}
                />
                
                {/* Small pulsing sparkles inside */}
                <motion.div
                    className="absolute bottom-2 right-2 text-indigo-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                    <Wand2 size={16} />
                </motion.div>
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="text-indigo-500" size={20}/>
                AI Analysis Engine
              </h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
                {message}
              </p>
            </div>

            {/* Animated Loading Bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-8 relative">
              <motion.div
                className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              />
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
