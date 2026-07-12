import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useAutoReintentoEnvios } from './hooks/useAutoReintentoEnvios';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Plantillas from './pages/Plantillas';
import Contactos from './pages/Contactos';
import Campanas from './pages/Campanas';
import Historial from './pages/Historial';

function PrivateLayout({ children }) {
  const { user, loading } = useAuth();
  useAutoReintentoEnvios(user);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-void">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-glow" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-[100dvh] bg-void bg-noise">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6 md:pt-36">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/plantillas" element={<PrivateLayout><Plantillas /></PrivateLayout>} />
      <Route path="/contactos" element={<PrivateLayout><Contactos /></PrivateLayout>} />
      <Route path="/campanas" element={<PrivateLayout><Campanas /></PrivateLayout>} />
      <Route path="/historial" element={<PrivateLayout><Historial /></PrivateLayout>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
