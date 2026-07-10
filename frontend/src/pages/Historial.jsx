import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DownloadSimple } from 'phosphor-react';
import Papa from 'papaparse';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import HistorialEnvios from '../components/HistorialEnvios';

export default function Historial() {
  const { user } = useAuth();
  const [campanas, setCampanas] = useState([]);
  const [plantillas, setPlantillas] = useState({});
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [nombrePlantilla, setNombrePlantilla] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(
      query(collection(db, 'campanas'), where('userId', '==', user.uid), where('estado', '==', 'completado')),
      (s) => setCampanas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(query(collection(db, 'plantillas'), where('userId', '==', user.uid)), (s) => {
      const map = {};
      s.docs.forEach((d) => { map[d.id] = d.data().nombre; });
      setPlantillas(map);
    });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const enriquecidas = useMemo(
    () => campanas.map((c) => ({ ...c, nombrePlantilla: plantillas[c.plantillaId] })),
    [campanas, plantillas]
  );

  const filtradas = enriquecidas.filter((c) => {
    if (nombrePlantilla && !c.nombrePlantilla?.toLowerCase().includes(nombrePlantilla.toLowerCase())) return false;
    const fecha = c.ejecutadoEn?.toDate?.();
    if (!fecha) return true;
    if (desde && fecha < new Date(desde)) return false;
    if (hasta && fecha > new Date(hasta)) return false;
    return true;
  });

  function handleDescargar() {
    const csv = Papa.unparse(
      filtradas.map((c) => ({
        plantilla: c.nombrePlantilla,
        estado: c.estado,
        enviados: c.resultados?.enviados || 0,
        fallidos: c.resultados?.fallidos || 0,
        fecha: c.ejecutadoEn?.toDate?.().toLocaleString('es-MX') || '',
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historial.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="eyebrow">Reportes</span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Historial</h1>
        </div>
        <button onClick={handleDescargar} className="group btn-pill">
          Descargar reporte
          <span className="btn-pill-icon"><DownloadSimple size={14} weight="bold" /></span>
        </button>
      </div>

      <div className="glass-shell animate-fade-up">
        <div className="glass-core grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input-field" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input-field" />
          <input
            placeholder="Filtrar por plantilla…"
            value={nombrePlantilla}
            onChange={(e) => setNombrePlantilla(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <HistorialEnvios campanas={filtradas} />
    </div>
  );
}
