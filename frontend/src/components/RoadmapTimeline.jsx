import React from 'react';
import { motion } from 'framer-motion';
import { Milestone, AlertCircle } from 'lucide-react';

export default function RoadmapTimeline({ roadmap = [] }) {
  if (!roadmap || !Array.isArray(roadmap) || roadmap.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
        <AlertCircle size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-bold text-slate-500 text-center">No structured roadmap steps available at this moment.</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-indigo-100 dark:border-indigo-900/50 ml-4 md:ml-6 mt-4 pb-4">
      {roadmap.map((step, index) => {
        // Robust step string resolution (handles objects/strings)
        const stepText = typeof step === 'string' ? step : (step.text || step.step || step.description || JSON.stringify(step));
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="relative mb-8 pl-8 sm:pl-10 last:mb-0"
          >
            {/* Timeline Node */}
            <div className="absolute -left-[17px] top-1 flex items-center justify-center w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 shadow-sm z-10 bg-indigo-500 text-white font-black text-[10px]">
              {index + 1}
            </div>

            {/* Content Card */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
              <h4 className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
                PHASE_0{index + 1}
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                {stepText}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
