import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { X, Lightning } from 'phosphor-react';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import SchedulerCampana from '../components/SchedulerCampana';

export default function Campanas() {
  const { user } = useAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [listas, setListas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [mensajesHoy, setMensajesHoy] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(query(collection(db, 'plantillas'), where('userId', '==', user.uid)), (s) =>
        setPlantillas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'contactos'), where('userId', '==', user.uid)), (s) =>
        setContactos(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'listas'), where('userId', '==', user.uid)), (s) =>
        setListas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'campanas'), where('userId', '==', user.uid)), (s) => {
        const docs = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCampanas(docs);
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);
        const hoy = docs
          .filter((c) => c.createdAt?.toDate?.() >= inicioHoy)
          .reduce((acc, c) => acc + (c.contactosIds?.length || 0), 0);
        setMensajesHoy(hoy);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const pendientes = campanas.filter((c) => c.estado === 'pendiente');
  const hayActiva = campanas.some((c) => c.estado === 'en_proceso');

  async function handleCrear({ plantillaId, contactosIds, fechaProgramada }) {
    await addDoc(collection(db, 'campanas'), {
      plantillaId,
      contactosIds,
      fechaProgramada: Timestamp.fromDate(fechaProgramada),
      estado: 'pendiente',
      resultados: { enviados: 0, fallidos: 0, pendientes: contactosIds.length },
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
  }

  async function handleCancelar(id) {
    await updateDoc(doc(db, 'campanas', id), { estado: 'cancelado' });
  }

  const [enviandoAhora, setEnviandoAhora] = useState(false);
  const [mensajeEnviarAhora, setMensajeEnviarAhora] = useState('');

  async function handleEnviarAhora() {
    setEnviandoAhora(true);
    setMensajeEnviarAhora('');
    try {
      const resp = await fetch('/api/disparar-envio', { method: 'POST' });
      const data = await resp.json();
      setMensajeEnviarAhora(
        resp.ok ? 'Disparado — el envío corre en unos segundos en GitHub Actions.' : `Error: ${data.error}`
      );
    } catch {
      setMensajeEnviarAhora('No se pudo contactar al servidor.');
    } finally {
      setEnviandoAhora(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="eyebrow">Automatización</span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Campañas</h1>
        </div>
        <div className="text-right">
          <button onClick={handleEnviarAhora} disabled={enviandoAhora} className="group btn-pill disabled:opacity-40">
            {enviandoAhora ? 'Disparando…' : 'Enviar ahora'}
            <span className="btn-pill-icon">
              <Lightning size={14} weight="bold" />
            </span>
          </button>
          {mensajeEnviarAhora && <p className="mt-2 text-xs text-white/40">{mensajeEnviarAhora}</p>}
        </div>
      </div>

      <SchedulerCampana
        plantillas={plantillas}
        contactos={contactos}
        listas={listas}
        mensajesHoy={mensajesHoy}
        hayActiva={hayActiva}
        onCrear={handleCrear}
      />

      <div className="glass-shell animate-fade-up">
        <div className="glass-core p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Campañas programadas</h2>
          {pendientes.length === 0 ? (
            <p className="text-sm text-white/30">No hay campañas pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {pendientes.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm">
                  <div className="text-white/70">
                    {c.fechaProgramada?.toDate?.().toLocaleString('es-MX')} · {c.contactosIds?.length || 0} contactos
                  </div>
                  <button onClick={() => handleCancelar(c.id)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400">
                    <X size={13} weight="light" /> Cancelar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
