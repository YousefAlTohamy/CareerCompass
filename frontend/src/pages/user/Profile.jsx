import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../api/endpoints';
import Swal from 'sweetalert2';
import { 
  MapPin, 
  Briefcase, 
  Mail, 
  Linkedin, 
  Github, 
  Phone,
  User as UserIcon,
  Calendar,
  LogOut,
  Edit2,
  Save,
  X,
  Link as LinkIcon,
  ShieldCheck,
  Award,
  Plus
} from 'lucide-react';

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

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUser();
      setProfile(response.data);
      setFormData(response.data || {});
      setError('');
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    if(e) e.preventDefault();
    try {
      setSaving(true);
      setError('');
      
      const response = await authAPI.updateProfile(formData);
      setProfile(response.data.data);
      
      // Force Global Auth context to refetch new identity
      await refreshUser();
      
      setEditing(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profile updated successfully',
        showConfirmButton: false,
        timer: 3000,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error saving profile:', err);
      if (err.response?.data?.errors?.email) {
        setError(err.response.data.errors.email[0]);
      } else {
        setError(err.response?.data?.message || 'Failed to save profile changes.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Logout?',
      text: "Are you sure you want to sign out of your account?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, logout'
    });

    if (result.isConfirmed) {
      await logout();
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 font-medium text-sm">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20 space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
           My Profile
        </h1>
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold transition-all border border-rose-100 shadow-sm w-fit"
        >
           <LogOut size={18} />
           Sign Out
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <X size={18} className="cursor-pointer" onClick={() => setError('')}/>
          {error}
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Banner & Avatar Section */}
        <div className="bg-slate-50 border-b border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mx-20 -my-20 pointer-events-none"></div>
          
          <div className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="w-32 h-32 rounded-full bg-white border-4 border-indigo-50 shadow-md text-indigo-600 flex items-center justify-center font-black text-4xl shrink-0">
              {getInitials(profile?.name)}
            </div>
            
            {/* Main Info */}
            <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start w-full">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-2">
                {profile?.name || 'Your Name'}
              </h2>
              
              {user?.role !== 'admin' && (
                <p className="text-lg text-slate-500 font-medium flex items-center justify-center md:justify-start gap-2 mb-6 bg-white px-4 py-1.5 rounded-lg border border-slate-100 shadow-sm w-fit">
                  <Briefcase size={18} className="text-indigo-500" /> 
                  {profile?.job_title || 'No Target Role Provided'}
                </p>
              )}

              {/* Toggle Edit Mode Button */}
              {!editing && (
                 <button
                   onClick={() => {
                     setEditing(true);
                     setFormData({
                       ...profile,
                       skills: profile?.skills ? profile.skills.map(s => s.name || s) : []
                     });
                   }}
                   className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm font-bold text-sm w-full md:w-auto justify-center"
                 >
                   <Edit2 size={16} /> Edit Profile
                 </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Body Section */}
        <div className="p-8 md:p-10">
          
          {editing ? (
             /* EDIT MODE FORM */
             <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                   <h3 className="text-lg font-bold text-slate-800">Edit Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                    />
                  </div>

                  {user?.role !== 'admin' && (
                    <>
                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Phone Number</label>
                        <input
                          type="text"
                          name="phone"
                          value={formData.phone || ''}
                          onChange={handleChange}
                          placeholder="+20 123 456 7890"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Location</label>
                        <input
                          type="text"
                          name="location"
                          value={formData.location || ''}
                          onChange={handleChange}
                          placeholder="e.g. Cairo, Egypt"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                      </div>

                      {/* Job Title */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700">Target Role / Profession</label>
                        <input
                          type="text"
                          name="job_title"
                          value={formData.job_title || ''}
                          onChange={handleChange}
                          placeholder="e.g. Backend Developer"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                      </div>

                      {/* LinkedIn */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">LinkedIn Profile URL</label>
                        <input
                          type="url"
                          name="linkedin_url"
                          value={formData.linkedin_url || ''}
                          onChange={handleChange}
                          placeholder="https://linkedin.com/in/..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                      </div>

                      {/* GitHub */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">GitHub Profile URL</label>
                        <input
                          type="url"
                          name="github_url"
                          value={formData.github_url || ''}
                          onChange={handleChange}
                          placeholder="https://github.com/..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                      </div>
                    </>
                  )}

                  {/* Skills (Edit Mode) */}
                  {user?.role !== 'admin' && (
                    <div className="space-y-3 md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700">Technical & Soft Skills</label>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(formData.skills || []).map((skill, index) => (
                          <span 
                            key={index} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-100 group"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => {
                                const updatedSkills = formData.skills.filter((_, i) => i !== index);
                                setFormData({ ...formData, skills: updatedSkills });
                              }}
                              className="text-indigo-400 hover:text-rose-500 hover:bg-rose-50 rounded-full p-0.5 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        {(!formData.skills || formData.skills.length === 0) && (
                          <span className="text-sm font-medium text-slate-400 italic py-1">No skills added yet.</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newSkill.trim()) {
                                if (!formData.skills?.includes(newSkill.trim())) {
                                  setFormData({
                                    ...formData,
                                    skills: [...(formData.skills || []), newSkill.trim()]
                                  });
                                }
                                setNewSkill('');
                              }
                            }
                          }}
                          placeholder="Type a skill and press Enter or Add"
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newSkill.trim() && !formData.skills?.includes(newSkill.trim())) {
                              setFormData({
                                ...formData,
                                skills: [...(formData.skills || []), newSkill.trim()]
                              });
                            }
                            setNewSkill('');
                          }}
                          className="flex items-center justify-center gap-1 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-all border border-slate-200"
                        >
                          <Plus size={16} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition shadow-sm font-bold disabled:opacity-50"
                  >
                    {saving ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Saving...</>
                    ) : (
                      <><Save size={18} /> Save Changes</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setFormData(profile);
                      setError('');
                    }}
                    disabled={saving}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-8 py-3 rounded-xl hover:bg-slate-200 transition font-bold disabled:opacity-50"
                  >
                    <X size={18} /> Cancel
                  </button>
                </div>
             </form>

          ) : (
             /* VIEW MODE */
             <div className="space-y-10 animate-in fade-in duration-300">
                
                {/* Contact & Personal Details Grid */}
                <div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <UserIcon size={16} /> Contact & Personal Details
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Mail size={18} /></div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-500 mb-0.5">Email Address</p>
                          <p className="font-medium text-slate-800 truncate" title={profile?.email}>{profile?.email}</p>
                        </div>
                      </div>

                      {user?.role !== 'admin' && (
                        <>
                          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Phone size={18} /></div>
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-0.5">Phone Number</p>
                              <p className="font-medium text-slate-800">{profile?.phone || <span className="text-slate-400 italic">Not provided</span>}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><MapPin size={18} /></div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-500 mb-0.5">Location</p>
                              <p className="font-medium text-slate-800 truncate" title={profile?.location}>{profile?.location || <span className="text-slate-400 italic">Not provided</span>}</p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="bg-white p-2 rounded-lg shadow-sm text-slate-400"><Calendar size={18} /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-0.5">Member Since</p>
                          <p className="font-medium text-slate-800">
                            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Professional Links */}
                {user?.role !== 'admin' && (
                   <div>
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                       <LinkIcon size={16} /> Professional Links
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       
                       {/* LinkedIn Card */}
                       {profile?.linkedin_url ? (
                         <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white hover:bg-blue-50 p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors group">
                            <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                              <Linkedin size={20} />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-slate-800 font-bold">LinkedIn Profile</div>
                              <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{profile.linkedin_url}</div>
                            </div>
                         </a>
                       ) : (
                         <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 opacity-70">
                            <div className="bg-slate-200 p-2.5 rounded-lg text-slate-400"><Linkedin size={20} /></div>
                            <div>
                              <div className="text-slate-600 font-bold text-sm">LinkedIn Profile</div>
                              <div className="text-xs font-medium text-slate-400 mt-0.5">Not added yet</div>
                            </div>
                         </div>
                       )}

                       {/* GitHub Card */}
                       {profile?.github_url ? (
                         <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white hover:bg-slate-100 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors group">
                            <div className="bg-slate-200 p-2.5 rounded-lg text-slate-700 group-hover:scale-110 transition-transform">
                              <Github size={20} />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-slate-800 font-bold">GitHub Profile</div>
                              <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{profile.github_url}</div>
                            </div>
                         </a>
                       ) : (
                         <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 opacity-70">
                            <div className="bg-slate-200 p-2.5 rounded-lg text-slate-400"><Github size={20} /></div>
                            <div>
                              <div className="text-slate-600 font-bold text-sm">GitHub Profile</div>
                              <div className="text-xs font-medium text-slate-400 mt-0.5">Not added yet</div>
                            </div>
                         </div>
                       )}
                       
                     </div>
                   </div>
                )}

                {/* Extracted Skills (View Mode) */}
                {user?.role !== 'admin' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <Award size={16} /> Extracted & Manual Skills
                    </h3>
                    
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      {Array.isArray(profile?.skills) && profile.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.map((skill, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-100"
                            >
                              {skill.name || skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <Award className="w-12 h-12 text-slate-200 mb-3 stroke-1" />
                          <p className="text-slate-500 font-medium">No skills extracted for your profile yet.</p>
                          <p className="text-xs text-slate-400 mt-1">Skills are automatically extracted when you upload a CV, or you can add them manually by editing your profile.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}