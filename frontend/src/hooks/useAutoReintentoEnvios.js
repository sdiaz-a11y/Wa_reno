import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const INTERVALO_REINTENTO_MS = 65 * 60 * 1000; // 1h 5min: cubre la hora del límite de envíos + margen
const CHEQUEO_MS = 60 * 1000;

function claveStorage(uid) {
  return `wasend_proximo_intento_${uid}`;
}

// Llamar justo después de disparar un envío manualmente, para que el
// reintento automático no dispare de nuevo enseguida.
export function marcarProximoIntento(uid) {
  localStorage.setItem(claveStorage(uid), String(Date.now() + INTERVALO_REINTENTO_MS));
}

async function dispararEnvio() {
  try {
    const token = await auth.currentUser?.getIdToken();
    await fetch('/api/disparar-envio', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // se reintenta en el próximo chequeo, sin bloquear la UI
  }
}

// Mientras esta pestaña siga abierta, reintenta el envío de campañas
// pendientes cada ~1h5min (el límite de envíos es por hora). No es un
// cron real de servidor: si cierras el navegador, se detiene.
export function useAutoReintentoEnvios(user) {
  const hayPendientesRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const key = claveStorage(user.uid);

    const unsub = onSnapshot(
      query(collection(db, 'campanas'), where('userId', '==', user.uid), where('estado', '==', 'pendiente')),
      (snap) => {
        hayPendientesRef.current = !snap.empty;
        if (snap.empty) localStorage.removeItem(key);
      }
    );

    const intervalo = setInterval(() => {
      if (!hayPendientesRef.current) return;
      const proximo = Number(localStorage.getItem(key)) || 0;
      if (Date.now() >= proximo) {
        localStorage.setItem(key, String(Date.now() + INTERVALO_REINTENTO_MS));
        dispararEnvio();
      }
    }, CHEQUEO_MS);

    return () => {
      unsub();
      clearInterval(intervalo);
    };
  }, [user]);
}
