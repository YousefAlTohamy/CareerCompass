import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 relative overflow-hidden font-sans">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center text-center">
        
        {/* Creative 404 Graphic */}
        <div className="relative mb-6">
          {/* Giant Background Text */}
          <h1 className="text-[140px] leading-none font-black text-slate-200 select-none tracking-tighter">
            404
          </h1>
          {/* Floating Floating Compass */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-slate-100 flex items-center justify-center text-indigo-600 rotate-12 hover:rotate-0 transition-transform duration-500 cursor-pointer">
              <Compass size={48} strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-4">
          Looks like you're off the map
        </h2>
        <p className="text-slate-500 font-medium mb-10 max-w-md mx-auto leading-relaxed">
          We couldn't find the page you were looking for. It might have been moved, deleted, or perhaps it never existed in our system.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-bold transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
          <Link
            to="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-md shadow-indigo-200"
          >
            <Home size={18} />
            <span>Back to Home</span>
          </Link>
        </div>

      </div>
    </div>
  );
}