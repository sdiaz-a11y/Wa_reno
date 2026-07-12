import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PaperPlaneTilt,
  Sun,
  Clock,
  CalendarPlus,
  ArrowRight,
  ChartLineUp,
} from 'phosphor-react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import WhatsAppPairing from '../components/WhatsAppPairing';

function StatCard({ label, value, icon: Icon, span = '' }) {
  return (
    <div className={`glass-shell animate-fade-up ${span}`}>
      <div className="glass-core flex h-full flex-col justify-between p-6">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{label}</span>
          <Icon size={16} weight="light" className="text-white/30" />
        </div>
        <p className="mt-6 font-display text-4xl font-semibold tracking-tight text-white">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, hoy: 0, pendientes: 0, ultimoEnvio: '—' });
  const [ultimasCampanas, setUltimasCampanas] = useState([]);
  const [proximasCampanas, setProximasCampanas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function cargar() {
      try {
        const logsRef = collection(db, 'logs_envios');
        const logsQuery = query(logsRef, where('userId', '==', user.uid), where('estado', '==', 'enviado'));
        const logsSnap = await getDocs(logsQuery);
        const total = logsSnap.size;

        const hace24h = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const hoy = logsSnap.docs.filter((d) => d.data().timestamp?.toMillis() >= hace24h.toMillis()).length;

        const campanasRef = collection(db, 'campanas');
        const pendientesQuery = query(campanasRef, where('userId', '==', user.uid), where('estado', '==', 'pendiente'));
        const pendientesSnap = await getDocs(pendientesQuery);

        const ultimasQuery = query(campanasRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
        const ultimasSnap = await getDocs(ultimasQuery);

        const proximasQuery = query(
          campanasRef,
          where('userId', '==', user.uid),
          where('estado', '==', 'pendiente'),
          orderBy('fechaProgramada', 'asc'),
          limit(3)
        );
        const proximasSnap = await getDocs(proximasQuery);

        const ultimoLog = logsSnap.docs.sort((a, b) => (b.data().timestamp?.toMillis() || 0) - (a.data().timestamp?.toMillis() || 0))[0];

        setStats({
          total,
          hoy,
          pendientes: pendientesSnap.size,
          ultimoEnvio: ultimoLog ? ultimoLog.data().timestamp.toDate().toLocaleString('es-MX') : '—',
        });
        setUltimasCampanas(ultimasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setProximasCampanas(proximasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="eyebrow">Panel general</span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WhatsAppPairing />
          <Link to="/campanas" className="group btn-pill">
            Nueva campaña
            <span className="btn-pill-icon">
              <CalendarPlus size={14} weight="bold" />
            </span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total enviados" value={cargando ? '—' : stats.total} icon={PaperPlaneTilt} />
        <StatCard label="Hoy" value={cargando ? '—' : stats.hoy} icon={Sun} />
        <StatCard label="Pendientes" value={cargando ? '—' : stats.pendientes} icon={Clock} />
        <StatCard label="Último envío" value={cargando ? '—' : stats.ultimoEnvio} icon={ChartLineUp} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="glass-shell animate-fade-up md:col-span-7">
          <div className="glass-core p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Últimas campañas</h2>
            {ultimasCampanas.length === 0 ? (
              <p className="text-sm text-white/30">Aún no hay campañas.</p>
            ) : (
              <ul className="space-y-2">
                {ultimasCampanas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm">
                    <span className="text-white/80">{c.estado}</span>
                    <span className="text-white/40">{c.contactosIds?.length || 0} contactos</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="glass-shell animate-fade-up md:col-span-5">
          <div className="glass-core p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Campañas pendientes</h2>
            {proximasCampanas.length === 0 ? (
              <p className="text-sm text-white/30">No hay campañas esperando envío.</p>
            ) : (
              <ul className="space-y-2">
                {proximasCampanas.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-white/70">
                    {c.contactosIds?.length || 0} contactos · esperando envío
                  </li>
                ))}
              </ul>
            )}
            <Link to="/campanas" className="group mt-4 inline-flex items-center gap-2 text-xs text-emerald-glow">
              Ver todas <ArrowRight size={12} weight="bold" className="transition-transform duration-500 ease-fluid group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
