import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { 
  MapPin, 
  Briefcase, 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  Mail, 
  Linkedin, 
  Github, 
  Award, 
  AlertCircle, 
  Phone,
  User as UserIcon,
  Calendar,
  Link as LinkIcon // <--- تم إضافة الأيقونة اللي كانت ناقصة وبتعمل الكراش
} from 'lucide-react';
import Swal from 'sweetalert2';

// Safe Helper function to get user initials
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const cleanName = name.trim();
  if (!cleanName) return '?';
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts[0]) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '?';
};

export default function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getAdminUserDetails(id);
      if (response.data && response.data.success) {
        setUser(response.data.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError('User not found.');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('Failed to load user details.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async () => {
    const isBanned = user.is_banned;
    const actionText = isBanned ? 'unban' : 'ban';
    const actionColor = isBanned ? '#10b981' : '#e11d48'; 
    const iconType = isBanned ? 'question' : 'warning';

    const result = await Swal.fire({
      title: `${isBanned ? 'Unban' : 'Ban'} User?`,
      text: `Are you sure you want to ${actionText} "${user.name}"?`,
      icon: iconType,
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: '#94a3b8',
      confirmButtonText: `Yes, ${actionText} user`
    });

    if (result.isConfirmed) {
      try {
        const response = await adminAPI.toggleUserBan(id);
        if (response.data && response.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Success',
            text: response.data.message || `User has been ${actionText}ned.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
          // Update local state safely
          setUser((prev) => ({ ...prev, is_banned: !isBanned }));
        }
      } catch (err) {
        console.error('Failed to toggle ban status:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || `Failed to ${actionText} user.`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 font-medium text-sm">Loading user profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-3xl mx-auto min-h-[60vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 border border-slate-200 shadow-sm text-center w-full">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">{error || 'User not found'}</h2>
          <p className="text-slate-500 font-medium mb-4">The user you are looking for does not exist or has been deleted.</p>
          <button 
            onClick={() => navigate('/admin/users')} 
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm"
          >
            Back to Users List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20 space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <button 
          onClick={() => navigate('/admin/users')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg font-bold transition-colors w-fit"
        >
           <ArrowLeft size={18} />
           Back to Users
        </button>
        
        <button 
          onClick={handleToggleBan}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
            user.is_banned 
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
          }`}
        >
           {user.is_banned ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
           {user.is_banned ? 'Unban User Account' : 'Ban User Account'}
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Banner & Avatar Section */}
        <div className="bg-slate-50 border-b border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
          
          <div className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            
            {/* Avatar */}
            <div className="w-32 h-32 rounded-full bg-white border-4 border-indigo-50 shadow-md text-indigo-600 flex items-center justify-center font-black text-4xl shrink-0">
              {getInitials(user.name)}
            </div>
            
            {/* Main Info */}
            <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start">
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                  ID: #{user.id}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    user.is_banned ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                  {user.is_banned ? 'Banned' : 'Active'}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-2">
                {user.name || 'Unknown User'}
              </h1>
              
              <p className="text-lg text-slate-500 font-medium flex items-center justify-center md:justify-start gap-2 mb-6 bg-white px-4 py-1.5 rounded-lg border border-slate-100 shadow-sm w-fit">
                <Briefcase size={18} className="text-indigo-500" /> 
                {user.job_title || 'No Job Title Provided'}
              </p>
            </div>
          </div>
        </div>

        {/* Details Body Section */}
        <div className="p-8 md:p-10 space-y-10">
          
          {/* Contact Info Grid */}
          <div>
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <UserIcon size={16} /> Contact & Personal Details
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Mail size={18} /></div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Email Address</p>
                    <p className="font-medium text-slate-800 truncate" title={user.email}>{user.email || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Phone size={18} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Phone Number</p>
                    <p className="font-medium text-slate-800">{user.phone || <span className="text-slate-400 italic">Not provided</span>}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><MapPin size={18} /></div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Location</p>
                    <p className="font-medium text-slate-800 truncate" title={user.location}>{user.location || <span className="text-slate-400 italic">Not provided</span>}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Calendar size={18} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-0.5">Joined Date</p>
                    <p className="font-medium text-slate-800">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
             </div>
          </div>

          {/* Social Links */}
          {(user.linkedin_url || user.github_url) && (
             <div>
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                 <LinkIcon size={16} /> Professional Links
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {user.linkedin_url && (
                   <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white hover:bg-blue-50 p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors group">
                      <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                        <Linkedin size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-slate-800 font-bold">LinkedIn Profile</div>
                        <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{user.linkedin_url}</div>
                      </div>
                   </a>
                 )}
                 {user.github_url && (
                   <a href={user.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white hover:bg-slate-100 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors group">
                      <div className="bg-slate-200 p-2.5 rounded-lg text-slate-700 group-hover:scale-110 transition-transform">
                        <Github size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-slate-800 font-bold">GitHub Profile</div>
                        <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{user.github_url}</div>
                      </div>
                   </a>
                 )}
               </div>
             </div>
          )}

          {/* User Skills Section */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Award size={16} /> Extracted Skills
            </h3>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              {Array.isArray(user.skills) && user.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-100"
                    >
                      {skill.name || skill}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Award className="w-12 h-12 text-slate-200 mb-3 stroke-1" />
                  <p className="text-slate-500 font-medium">No skills extracted for this user yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Skills are automatically extracted when the user uploads a CV.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}