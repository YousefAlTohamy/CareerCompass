import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

// ── Public / Auth pages ──────────────────────────────────────────────────────
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import AboutUs from './pages/AboutUs';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import SystemStatus from './pages/SystemStatus';
import Footer from './components/Footer';

// ── User pages ───────────────────────────────────────────────────────────────
import Dashboard from './pages/user/Dashboard';
import Jobs from './pages/user/Jobs';
import GapAnalysis from './pages/user/GapAnalysis';
import Profile from './pages/user/Profile';
import MarketIntelligence from './pages/user/MarketIntelligence';
import Applications from './pages/user/Applications';

// ── Admin pages ──────────────────────────────────────────────────────────────
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminJobs from './pages/admin/AdminJobs';
import AdminJobDetails from './pages/admin/AdminJobDetails';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetails from './pages/admin/AdminUserDetails';
import AdminSources from './pages/admin/AdminSources';
import AdminTargets from './pages/admin/AdminTargets';

import './index.css';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="min-h-[calc(100vh-64px)]"
      >
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

          {/* ── Protected User Routes ─────────────────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Jobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gap-analysis/:jobId"
            element={
              <ProtectedRoute>
                <GapAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowAdmin={true}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute>
                <MarketIntelligence />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <Applications />
              </ProtectedRoute>
            }
          />

          {/* ── Protected Admin Routes ───────────────────────────────── */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs"
            element={
              <ProtectedRoute requireAdmin>
                <AdminJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs/:id"
            element={
              <ProtectedRoute requireAdmin>
                <AdminJobDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireAdmin>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <ProtectedRoute requireAdmin>
                <AdminUserDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sources"
            element={
              <ProtectedRoute requireAdmin>
                <AdminSources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/targets"
            element={
              <ProtectedRoute requireAdmin>
                <AdminTargets />
              </ProtectedRoute>
            }
          />

          {/* Public Informational Routes */}
          <Route path="/about" element={<AboutUs />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/status" element={<SystemStatus />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <Navbar />
            <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pt-16 flex flex-col">
              <div className="flex-grow">
                <AnimatedRoutes />
              </div>
              <Footer />
            </div>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
