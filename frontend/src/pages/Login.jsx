import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnvelopeSimple, LockSimple, ArrowRight, WhatsappLogo } from 'phosphor-react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (modo === 'login') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate('/');
    } catch (err) {
      setError('No se pudo autenticar. Verifica tus credenciales.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4 py-12 bg-noise">
      <div className="pointer-events-none absolute -left-40 top-0 h-[32rem] w-[32rem] animate-orb-drift rounded-full bg-emerald-glow/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] animate-orb-drift rounded-full bg-violet-glow/10 blur-[120px]" />

      <div className="w-full max-w-md animate-fade-up">
        <div className="glass-shell">
          <div className="glass-core px-8 py-10 sm:px-10 sm:py-12">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-glow/10 ring-1 ring-emerald-glow/30">
                <WhatsappLogo size={22} weight="light" className="text-emerald-glow" />
              </div>
              <span className="eyebrow mb-4">Plataforma de envío</span>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
                {modo === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
              </h1>
              <p className="mt-2 text-sm text-white/40">
                {modo === 'login' ? 'Ingresa para gestionar tus campañas.' : 'Comienza a enviar en minutos.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <EnvelopeSimple size={18} weight="light" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="input-field pl-11"
                />
              </div>
              <div className="relative">
                <LockSimple size={18} weight="light" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="input-field pl-11"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button type="submit" disabled={cargando} className="group btn-pill w-full justify-center disabled:opacity-50">
                {cargando ? 'Procesando…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
                <span className="btn-pill-icon">
                  <ArrowRight size={14} weight="bold" />
                </span>
              </button>
            </form>

            <button
              onClick={() => setModo(modo === 'login' ? 'signup' : 'login')}
              className="mt-6 w-full text-center text-xs text-white/40 transition-colors duration-300 hover:text-white/70"
            >
              {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
