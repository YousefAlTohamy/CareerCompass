import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GraduationDemoPreview({ children }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
          <AlertCircle size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300 mb-1">
            {t('demo_preview.title', 'Graduation Demo Preview')}
          </p>
          <p className="font-bold leading-relaxed">
            {t(
              'demo_preview.body',
              'This module is included as a planned extension for the graduation demo and is not presented as a fully evaluated production feature.'
            )}
          </p>
          {children && (
            <p className="mt-2 font-medium leading-relaxed text-amber-700/90 dark:text-amber-200/90">
              {children}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
