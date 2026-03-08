import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * GuestRoute — guards routes that should only be accessible to unauthenticated users.
 * Redirects logged-in users to their respective dashboards.
 */
export default function GuestRoute({ children }) {
  const { user } = useAuth();

  // If user is already logged in, redirect them away from auth pages
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/scraping-sources" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
