import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// ── Public / Auth pages ──────────────────────────────────────────────────────
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

// ── User pages ───────────────────────────────────────────────────────────────
import Dashboard from './pages/user/Dashboard';
import Jobs from './pages/user/Jobs';
import GapAnalysis from './pages/user/GapAnalysis';
import Profile from './pages/user/Profile';
import MarketIntelligence from './pages/user/MarketIntelligence';
import Applications from './pages/user/Applications';

// ── Admin pages ──────────────────────────────────────────────────────────────
import AdminSources from './pages/admin/AdminSources';

import './index.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Navbar />
          <div className="min-h-screen bg-gray-50 pt-16">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

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
                  <ProtectedRoute>
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
                path="/admin/scraping-sources"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminSources />
                  </ProtectedRoute>
                }
              />

              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
