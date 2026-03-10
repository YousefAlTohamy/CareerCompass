import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = "Loading...", fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center p-6 font-sans text-center space-y-3">
      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
        <Loader2 className="animate-spin" size={28} />
      </div>
      {message && <p className="text-slate-500 font-bold text-sm animate-pulse tracking-wide">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="flex justify-center py-12">{content}</div>;
}
