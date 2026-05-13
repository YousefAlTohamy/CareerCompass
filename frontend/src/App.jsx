import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import Footer from './components/Footer';
import { ThemeProvider } from './context/ThemeContext';
import ScrollToTop from './components/ScrollToTop';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const SystemStatus = lazy(() => import('./pages/SystemStatus'));
const Dashboard = lazy(() => import('./pages/user/Dashboard'));
const Jobs = lazy(() => import('./pages/user/Jobs'));
const GapAnalysis = lazy(() => import('./pages/user/GapAnalysis'));
const Profile = lazy(() => import('./pages/user/Profile'));
const MarketIntelligence = lazy(() => import('./pages/user/MarketIntelligence'));
const Applications = lazy(() => import('./pages/user/Applications'));
const CVBuilder = lazy(() => import('./pages/user/CVBuilder'));
const MockInterview = lazy(() => import('./pages/user/MockInterview'));
const LearningPaths = lazy(() => import('./pages/user/LearningPaths'));
const CareerPlanner = lazy(() => import('./pages/user/CareerPlanner'));
const Mentorship = lazy(() => import('./pages/user/Mentorship'));
const ToolsHub = lazy(() => import('./pages/user/ToolsHub'));
const Settings = lazy(() => import('./pages/user/Settings'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminJobDetails = lazy(() => import('./pages/admin/AdminJobDetails'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetails = lazy(() => import('./pages/admin/AdminUserDetails'));
const AdminSources = lazy(() => import('./pages/admin/AdminSources'));
const AdminTargets = lazy(() => import('./pages/admin/AdminTargets'));

const LoadingScreen = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
    Loading...
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="min-h-[calc(100vh-64px)]"
      >
        <Suspense fallback={<LoadingScreen />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/gap-analysis/:jobId" element={<ProtectedRoute><GapAnalysis /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowAdmin={true}><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/market" element={<ProtectedRoute><MarketIntelligence /></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
            <Route path="/cv-builder" element={<ProtectedRoute><CVBuilder /></ProtectedRoute>} />
            <Route path="/mock-interview" element={<ProtectedRoute><MockInterview /></ProtectedRoute>} />
            <Route path="/learning" element={<ProtectedRoute><LearningPaths /></ProtectedRoute>} />
            <Route path="/career-planner" element={<ProtectedRoute><CareerPlanner /></ProtectedRoute>} />
            <Route path="/mentorship" element={<ProtectedRoute><Mentorship /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><ToolsHub /></ProtectedRoute>} />

            <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/jobs" element={<ProtectedRoute requireAdmin><AdminJobs /></ProtectedRoute>} />
            <Route path="/admin/jobs/:id" element={<ProtectedRoute requireAdmin><AdminJobDetails /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requireAdmin><AdminUserDetails /></ProtectedRoute>} />
            <Route path="/admin/sources" element={<ProtectedRoute requireAdmin><AdminSources /></ProtectedRoute>} />
            <Route path="/admin/targets" element={<ProtectedRoute requireAdmin><AdminTargets /></ProtectedRoute>} />

            <Route path="/about" element={<AboutUs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/status" element={<SystemStatus />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function AppLayout() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      className="min-h-screen flex flex-col transition-colors duration-300"
    >
      <Navbar />
      <div className="flex-grow pt-16">
        <AnimatedRoutes />
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
