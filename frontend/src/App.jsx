import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useOnboarding } from './hooks/useOnboarding';
import Layout from './components/Layout';
import TodayPage from './pages/TodayPage';
import HabitDetailPage from './pages/HabitDetailPage';
import ManagePage from './pages/ManagePage';
import SettingsPage from './pages/SettingsPage';
import AdminDashboard from './pages/AdminDashboard';
import OnboardingWizard from './components/OnboardingWizard/OnboardingWizard';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import LoadingScreen from './components/LoadingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile: don't refetch every time the app regains focus (tab switch,
      // notification, lock/unlock) — this was the main source of perceived lag.
      refetchOnWindowFocus: false,
      // One retry is enough; 2 made failures on flaky mobile networks take ~3x longer to surface.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');

  if (loading) return <LoadingScreen message="Checking authentication" />;
  if (!user) {
    return authPage === 'login' ? (
      <LoginPage onSwitch={() => setAuthPage('register')} />
    ) : (
      <RegisterPage onSwitch={() => setAuthPage('login')} />
    );
  }
  return children;
}

function OnboardingGate() {
  const { isOnboarded, skipOnboarding } = useOnboarding();
  if (!isOnboarded) return <OnboardingWizard onComplete={skipOnboarding} />;
  return <Layout />;
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  const inner = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthGate><Navigate to="/" replace /></AuthGate>} />
              <Route path="/register" element={<AuthGate><Navigate to="/" replace /></AuthGate>} />
              <Route path="/onboarding" element={<AuthGate><OnboardingGate /></AuthGate>} />

              <Route element={<AuthGate><OnboardingGate /></AuthGate>}>
                <Route index element={<TodayPage />} />
                <Route path="detail" element={<HabitDetailPage />} />
                <Route path="manage" element={<ManagePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminDashboard />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster position="bottom-right"
              toastOptions={{
                style: { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
              }} />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );

  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{inner}</GoogleOAuthProvider>;
  }
  return inner;
}
