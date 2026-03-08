import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../api/endpoints';
import Swal from 'sweetalert2';

export default function Profile() {
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

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
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      const response = await authAPI.updateProfile(formData);
      setProfile(response.data.data);
      
      // Force Global Auth context to refetch new identity (new name/email/role)
      await refreshUser();
      
      setEditing(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profile updated successfully',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error('Error saving profile:', err);
      // Surface specific Laravel validation errors (like non-unique emails)
      if (err.response?.data?.errors?.email) {
        setError(err.response.data.errors.email[0]);
      } else {
        setError(err.response?.data?.message || 'Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Logout?',
      text: "Are you sure you want to sign out?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, logout',
      customClass: {
        confirmButton: 'rounded-xl font-bold px-6 py-3',
        cancelButton: 'rounded-xl font-bold px-6 py-3'
      }
    });

    if (result.isConfirmed) {
      await logout();
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition font-semibold"
              >
                Edit
              </button>
            )}
          </div>

          {/* Profile Information */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              {editing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900">{profile?.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              {editing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900">{profile?.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              {editing ? (
                <input
                  type="text"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. +1 234 567 890"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900">{profile?.phone || <span className="text-slate-400 italic text-sm">Not provided</span>}</p>
              )}
            </div>

            {/* Role / Job Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Role
              </label>
              {editing ? (
                <input
                  type="text"
                  name="job_title"
                  value={formData.job_title || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Software Engineer"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900">{profile?.job_title || <span className="text-slate-400 italic text-sm">Not provided</span>}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              {editing ? (
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. New York, NY"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900">{profile?.location || <span className="text-slate-400 italic text-sm">Not provided</span>}</p>
              )}
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile
              </label>
              {editing ? (
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://linkedin.com/in/..."
                />
              ) : (
                profile?.linkedin_url ? (
                  <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-lg font-semibold text-primary hover:underline block truncate">
                    {profile.linkedin_url}
                  </a>
                ) : (
                  <p className="text-lg font-semibold text-slate-400 italic">Not provided</p>
                )
              )}
            </div>

            {/* GitHub */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Profile
              </label>
              {editing ? (
                <input
                  type="url"
                  name="github_url"
                  value={formData.github_url || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://github.com/..."
                />
              ) : (
                profile?.github_url ? (
                  <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-lg font-semibold text-primary hover:underline block truncate">
                    {profile.github_url}
                  </a>
                ) : (
                  <p className="text-lg font-semibold text-slate-400 italic">Not provided</p>
                )
              )}
            </div>

            {/* Joined Date */}
            {profile?.created_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Member Since</label>
                <p className="text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-6 border-t flex gap-4">
              {editing && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-secondary transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setFormData(profile);
                    }}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
