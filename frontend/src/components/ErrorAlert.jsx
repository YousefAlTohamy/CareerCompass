import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

export default function ErrorAlert({ title = "Error", message, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm mb-6 flex items-start gap-3 relative overflow-hidden"
      >
        {/* Left decorative border */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400" />
        
        <div className="text-rose-500 mt-0.5 shrink-0">
          <AlertCircle size={20} strokeWidth={2.5} />
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-black text-rose-800 tracking-tight">{title}</h4>
          <p className="text-sm font-medium text-rose-600 mt-0.5 leading-relaxed">{message}</p>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="shrink-0 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
