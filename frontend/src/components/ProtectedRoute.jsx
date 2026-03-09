import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — guards routes that require authentication.
 *
 * Props:
 *   requireAdmin  (bool) — if true, also requires user.role === 'admin'.
 *                          Non-admin users are redirected to "/" instead of "/login".
 */
export default function ProtectedRoute({ children, requireAdmin = false, allowAdmin = false }) {
  const { user } = useAuth();

  // Not logged in → send to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin and admin is required → send to home
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Logged in as admin but accessing normal user route (not explicitly allowed) → send to admin dashboard/sources
  if (!requireAdmin && !allowAdmin && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
