import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Trash2, 
  ExternalLink, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  MoreVertical,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import applicationsAPI from '../api/applications';
import ProcessingAnimation from '../components/ProcessingAnimation';

const STATUS_CONFIG = {
  saved: { label: 'Saved', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  applied: { label: 'Applied', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  interviewing: { label: 'Interviewing', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  offered: { label: 'Offered', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-600 border-red-100' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const response = await applicationsAPI.getApplications();
      setApplications(response.data.data);
    } catch (err) {
      setError('Failed to load applications. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await applicationsAPI.updateApplication(id, { status: newStatus });
      setApplications(prev => prev.map(app => 
        app.id === id ? { ...app, status: newStatus } : app
      ));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const deleteApplication = async (id) => {
    if (!window.confirm('Are you sure you want to remove this from your tracker?')) return;
    try {
      await applicationsAPI.removeApplication(id);
      setApplications(prev => prev.filter(app => app.id !== id));
    } catch (err) {
      alert('Failed to remove application');
    }
  };

  const filteredApps = filter === 'all' 
    ? applications 
    : applications.filter(app => app.status === filter);

  if (loading) return <ProcessingAnimation isVisible={true} />;

  return (
    <div className="min-h-screen bg-slate-50 pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl font-black text-primary tracking-tight"
            >
              Career <span className="text-secondary font-medium italic">Tracker</span>
            </motion.h1>
            <p className="text-slate-500 mt-2 font-medium">Manage your professional pipeline and interview stages.</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
             <Filter size={18} className="ml-3 text-slate-400" />
             <select 
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
               className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer pr-8"
             >
                <option value="all">All Applications</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
             </select>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 font-medium">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredApps.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
               <Briefcase size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No applications found</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8">
              Start by saving jobs you like from the Discovery board or recommendations.
            </p>
            <Link to="/jobs" className="btn-primary inline-flex items-center gap-2">
               Discover Jobs <ChevronRight size={18} />
            </Link>
          </motion.div>
        )}

        {/* Applications List */}
        <div className="grid gap-6">
          <AnimatePresence mode="popLayout">
            {filteredApps.map((app, index) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-premium transition-all p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {/* Job Primary Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <Link to={`/jobs`} className="group/title">
                         <h3 className="text-xl font-bold text-slate-900 group-hover/title:text-primary transition-colors truncate">
                           {app.job.title}
                         </h3>
                      </Link>
                      <div className={`lg:hidden px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${STATUS_CONFIG[app.status].color}`}>
                        {STATUS_CONFIG[app.status].label}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm font-medium text-slate-500">
                       <span className="flex items-center gap-1.5 text-slate-900 font-bold">
                          <Briefcase size={16} className="text-primary" />
                          {app.job.company}
                       </span>
                       <span className="flex items-center gap-1.5">
                          <MapPin size={16} />
                          {app.job.location}
                       </span>
                       <span className="flex items-center gap-1.5">
                          <Calendar size={16} />
                          Added {new Date(app.created_at).toLocaleDateString()}
                       </span>
                    </div>
                  </div>

                  {/* Status Picker & Actions */}
                  <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0">
                     <div className="hidden lg:block">
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${STATUS_CONFIG[app.status].color}`}>
                          {STATUS_CONFIG[app.status].label}
                        </div>
                     </div>

                     <div className="relative group/status flex-1 lg:flex-none">
                        <select 
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value)}
                          className="w-full lg:w-auto bg-slate-50 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-primary focus:border-primary px-4 py-2 cursor-pointer"
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                          ))}
                        </select>
                     </div>

                     <div className="flex items-center gap-2">
                        <Link 
                          to={`/gap-analysis/job/${app.job.id}`}
                          className="p-2.5 bg-primary/5 text-primary hover:bg-primary hover:text-white rounded-xl transition-all"
                          title="View Gap Analysis"
                        >
                          <CheckCircle2 size={20} />
                        </Link>
                        {app.job.url && (
                          <a 
                            href={app.job.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2.5 bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl transition-all"
                          >
                            <ExternalLink size={20} />
                          </a>
                        )}
                        <button 
                          onClick={() => deleteApplication(app.id)}
                          className="p-2.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                     </div>
                  </div>
                </div>

                {/* Notes Section Placeholder */}
                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-400">
                   <div className="flex items-center gap-2">
                      <Clock size={14} />
                      Last updated {new Date(app.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                   {app.applied_at && (
                     <div className="text-secondary font-bold">
                        Applied on {new Date(app.applied_at).toLocaleDateString()}
                     </div>
                   )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
