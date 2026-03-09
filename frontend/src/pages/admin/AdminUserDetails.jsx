import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/endpoints';
import { MapPin, Briefcase, Link as LinkIcon, ArrowLeft, ShieldAlert, ShieldCheck, Mail, Linkedin, Github, Award, AlertCircle, Phone } from 'lucide-react';
import Swal from 'sweetalert2';

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
    const actionColor = isBanned ? '#10b981' : '#ef4444'; 
    const iconType = isBanned ? 'question' : 'warning';

    const result = await Swal.fire({
      title: `${isBanned ? 'Unban' : 'Ban'} User?`,
      text: `Are you sure you want to ${actionText} "${user.name}"?`,
      icon: iconType,
      showCancelButton: true,
      confirmButtonColor: actionColor,
      cancelButtonColor: '#94a3b8',
      confirmButtonText: `Yes, ${actionText} them!`
    });

    if (result.isConfirmed) {
      try {
        const response = await adminAPI.toggleUserBan(id);
        if (response.data && response.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: response.data.message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
          // Update local state
          setUser((prev) => ({ ...prev, is_banned: response.data.data.is_banned }));
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
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-600 p-8 rounded-3xl flex flex-col items-center gap-4 border border-red-100 shadow-sm max-w-md text-center">
          <AlertCircle size={64} className="text-red-400" />
          <h2 className="text-2xl font-black">{error || 'User not found'}</h2>
          <button 
            onClick={() => navigate('/admin/users')} 
            className="mt-2 bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen pb-20">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate('/admin/users')}
          className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold transition-colors"
        >
           <ArrowLeft size={20} />
           Back to Users
        </button>
        
        <button 
          onClick={handleToggleBan}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors border ${
            user.is_banned 
            ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' 
            : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
          }`}
        >
           {user.is_banned ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
           {user.is_banned ? 'Unban User' : 'Ban User'}
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Header Section */}
        <div className="p-8 md:p-10 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl -mx-20 -my-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                  #{user.id}
                </span>
                {user.is_banned ? (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider">
                       Banned
                   </span>
                ) : (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 uppercase tracking-wider">
                       Active
                   </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2 leading-tight">
                {user.name}
              </h1>
              <p className="text-lg text-slate-500 font-medium flex items-center gap-2 mb-6">
                <Briefcase size={20} /> {user.job_title || 'No Job Title Provided'}
              </p>
              
              <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="text-primary" size={18} />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                   <div className="flex items-center gap-2">
                     <Phone className="text-primary" size={18} />
                     <span>{user.phone}</span>
                   </div>
                )}
                {user.location && (
                   <div className="flex items-center gap-2">
                     <MapPin className="text-secondary" size={18} />
                     <span>{user.location}</span>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-8 md:p-10">
          
          {/* Contact Links Grid */}
          {(user.linkedin_url || user.github_url) && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 pb-10 border-b border-slate-100">
               {user.linkedin_url && (
                 <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-slate-50 hover:bg-indigo-50 p-5 rounded-2xl border border-slate-100 transition-colors group">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                      <Linkedin size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">LinkedIn</div>
                      <div className="text-slate-900 font-medium truncate max-w-[200px] mt-1">View Profile</div>
                    </div>
                 </a>
               )}
               {user.github_url && (
                 <a href={user.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 p-5 rounded-2xl border border-slate-100 transition-colors group">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-slate-900 group-hover:scale-110 transition-transform">
                      <Github size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">GitHub</div>
                      <div className="text-slate-900 font-medium truncate max-w-[200px] mt-1">View Repositories</div>
                    </div>
                 </a>
               )}
             </div>
          )}

          {/* User Skills Section */}
          <div>
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <Award className="text-primary" />
              Extracted Skills
            </h3>
            
            {user.skills && user.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.skills.map((skill, index) => (
                  <span 
                    key={index} 
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-sm font-bold shadow-sm"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center font-medium">
                No skills extracted for this user yet.
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
