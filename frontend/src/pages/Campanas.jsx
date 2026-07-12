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
} from 'firebase/firestore';
import { X, ArrowClockwise } from 'phosphor-react';
import { db, auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { marcarProximoIntento } from '../hooks/useAutoReintentoEnvios';
import SchedulerCampana from '../components/SchedulerCampana';

async function dispararEnvio() {
  const token = await auth.currentUser?.getIdToken();
  const resp = await fetch('/api/disparar-envio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  return { ok: resp.ok, error: data.error };
}

export default function Campanas() {
  const { user } = useAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [listas, setListas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [mensajesHoy, setMensajesHoy] = useState(0);
  const [revisando, setRevisando] = useState(false);
  const [mensajeRevisar, setMensajeRevisar] = useState('');

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

  async function handleEnviar({ plantillaId, contactosIds }) {
    await addDoc(collection(db, 'campanas'), {
      plantillaId,
      contactosIds,
      fechaProgramada: serverTimestamp(),
      estado: 'pendiente',
      resultados: { enviados: 0, fallidos: 0, pendientes: contactosIds.length },
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
    await dispararEnvio();
    marcarProximoIntento(user.uid);
  }

  async function handleCancelar(id) {
    await updateDoc(doc(db, 'campanas', id), { estado: 'cancelado' });
  }

  async function handleRevisarPendientes() {
    setRevisando(true);
    setMensajeRevisar('');
    const { ok, error } = await dispararEnvio();
    if (ok) marcarProximoIntento(user.uid);
    setMensajeRevisar(ok ? 'Revisando pendientes ahora mismo…' : `Error: ${error}`);
    setRevisando(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Automatización</span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Campañas</h1>
        </div>
        <div className="text-right">
          <button onClick={handleRevisarPendientes} disabled={revisando} className="group btn-pill disabled:opacity-40">
            {revisando ? 'Revisando…' : 'Revisar pendientes'}
            <span className="btn-pill-icon">
              <ArrowClockwise size={14} weight="bold" />
            </span>
          </button>
          {mensajeRevisar && <p className="mt-2 text-xs text-white/40">{mensajeRevisar}</p>}
        </div>
      </div>

      <SchedulerCampana
        plantillas={plantillas}
        contactos={contactos}
        listas={listas}
        mensajesHoy={mensajesHoy}
        hayActiva={hayActiva}
        onEnviar={handleEnviar}
      />

      {pendientes.length > 0 && (
        <div className="glass-shell animate-fade-up">
          <div className="glass-core p-6">
            <h2 className="font-display text-lg font-semibold">Campañas en curso</h2>
            <p className="mb-4 mt-1 text-xs text-white/30">
              Se reintentan solas cada ~1h con esta pestaña abierta. Si la cierras, usa "Revisar pendientes".
            </p>
            <ul className="space-y-2">
              {pendientes.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm">
                  <div className="text-white/70">{c.contactosIds?.length || 0} contactos · esperando envío</div>
                  <button onClick={() => handleCancelar(c.id)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400">
                    <X size={13} weight="light" /> Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
