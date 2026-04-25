import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const HUDEmptyState = ({ 
  icon: Icon = Database, 
  title, 
  description, 
  action 
}) => {
  const { t } = useTranslation();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-12 text-center space-y-6 glass-card rounded-[3rem] border-slate-200 dark:border-white/5 bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="relative w-24 h-24 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center shadow-inner">
          <Icon size={48} className="text-slate-400 dark:text-slate-500" />
        </div>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center"
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
        </motion.div>
      </div>

      <div className="max-w-xs space-y-2">
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
          {title || t('common.no_data', 'No Data Found')}
        </h3>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {description || t('common.no_data_desc', 'Our scanners couldn\'t find any records matching your criteria.')}
        </p>
      </div>

      {action && (
        <div className="pt-4">
          {action}
        </div>
      )}
    </motion.div>
  );
};

export default HUDEmptyState;
