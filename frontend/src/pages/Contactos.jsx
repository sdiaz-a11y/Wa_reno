import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { MagnifyingGlass, Trash, DownloadSimple, CaretLeft, CaretRight } from 'phosphor-react';
import Papa from 'papaparse';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import CargadorContactos from '../components/CargadorContactos';

const POR_PAGINA = 10;

export default function Contactos() {
  const { user } = useAuth();
  const [contactos, setContactos] = useState([]);
  const [listas, setListas] = useState([]);
  const [filtroLista, setFiltroLista] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [seleccionados, setSeleccionados] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(query(collection(db, 'contactos'), where('userId', '==', user.uid)), (snap) => {
        setContactos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
      onSnapshot(query(collection(db, 'listas'), where('userId', '==', user.uid)), (snap) => {
        setListas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  async function handleImportarLote(contactosNuevos, { listaId, nombreLista }) {
    let listaIdFinal = listaId;
    if (!listaIdFinal) {
      const listaRef = await addDoc(collection(db, 'listas'), {
        nombre: nombreLista,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      listaIdFinal = listaRef.id;
    }

    const batch = writeBatch(db);
    contactosNuevos.forEach(({ nombre, telefono }) => {
      const ref = doc(collection(db, 'contactos'));
      batch.set(ref, {
        nombre,
        telefono,
        estado: 'activo',
        listaId: listaIdFinal,
        listaNombre: nombreLista,
        importadoEn: serverTimestamp(),
        userId: user.uid,
      });
    });
    await batch.commit();
  }

  async function handleEliminar(id) {
    await deleteDoc(doc(db, 'contactos', id));
  }

  async function handleEliminarLote() {
    const batch = writeBatch(db);
    seleccionados.forEach((id) => batch.delete(doc(db, 'contactos', id)));
    await batch.commit();
    setSeleccionados(new Set());
  }

  function handleDescargar() {
    const csv = Papa.unparse(contactos.map((c) => ({ nombre: c.nombre, telefono: c.telefono })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtrados = useMemo(
    () =>
      contactos.filter(
        (c) =>
          (!filtroLista || c.listaId === filtroLista) &&
          (c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono?.includes(busqueda))
      ),
    [contactos, busqueda, filtroLista]
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pageItems = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  function toggleSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow">Base de datos</span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Contactos</h1>
        <p className="mt-2 text-sm text-white/40">{contactos.length} contactos cargados</p>
      </div>

      <CargadorContactos existentes={contactos} listas={listas} onImportarLote={handleImportarLote} />

      <div className="glass-shell animate-fade-up">
        <div className="glass-core p-6">
          <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-xs">
                <MagnifyingGlass size={16} weight="light" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                  placeholder="Buscar nombre o teléfono…"
                  className="input-field pl-11"
                />
              </div>
              <select
                value={filtroLista}
                onChange={(e) => { setFiltroLista(e.target.value); setPagina(1); }}
                className="input-field w-full max-w-[220px] appearance-none"
              >
                <option value="">Todas las listas</option>
                {listas.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              {seleccionados.size > 0 && (
                <button onClick={handleEliminarLote} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300">
                  <Trash size={13} weight="light" /> Eliminar ({seleccionados.size})
                </button>
              )}
              <button onClick={handleDescargar} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                <DownloadSimple size={13} weight="light" /> Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-white/30">
                  <th className="py-3 pr-4"></th>
                  <th className="py-3 pr-4">Nombre</th>
                  <th className="py-3 pr-4">Teléfono</th>
                  <th className="py-3 pr-4">Lista</th>
                  <th className="py-3 pr-4">Estado</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 text-white/70">
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(c.id)}
                        onChange={() => toggleSeleccion(c.id)}
                        className="h-4 w-4 rounded accent-emerald-glow"
                      />
                    </td>
                    <td className="py-3 pr-4">{c.nombre}</td>
                    <td className="py-3 pr-4 text-white/50">{c.telefono}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">
                        {c.listaNombre || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">
                        {c.estado}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => handleEliminar(c.id)} className="text-white/30 hover:text-red-400">
                        <Trash size={14} weight="light" />
                      </button>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-white/30">Sin contactos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-white/40">
              <span>Página {pagina} de {totalPaginas}</span>
              <div className="flex gap-2">
                <button
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 disabled:opacity-30"
                >
                  <CaretLeft size={14} weight="light" />
                </button>
                <button
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 disabled:opacity-30"
                >
                  <CaretRight size={14} weight="light" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
