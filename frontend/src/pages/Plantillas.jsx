import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { Plus, MagnifyingGlass, PencilSimple, Trash, FileText } from 'phosphor-react';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import PlantillaEditor from '../components/PlantillaEditor';

export default function Plantillas() {
  const { user } = useAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'plantillas'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setPlantillas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  async function handleGuardar(data) {
    if (editando) {
      await updateDoc(doc(db, 'plantillas', editando.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'plantillas'), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setMostrarEditor(false);
    setEditando(null);
  }

  async function handleEliminar(id) {
    await deleteDoc(doc(db, 'plantillas', id));
  }

  const filtradas = plantillas.filter((p) => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="eyebrow">Contenido</span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Plantillas</h1>
        </div>
        {!mostrarEditor && (
          <button onClick={() => { setEditando(null); setMostrarEditor(true); }} className="group btn-pill">
            Nueva plantilla
            <span className="btn-pill-icon">
              <Plus size={14} weight="bold" />
            </span>
          </button>
        )}
      </div>

      {mostrarEditor && (
        <PlantillaEditor
          inicial={editando}
          onGuardar={handleGuardar}
          onCancelar={() => { setMostrarEditor(false); setEditando(null); }}
        />
      )}

      {!mostrarEditor && (
        <>
          <div className="relative max-w-sm">
            <MagnifyingGlass size={16} weight="light" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar plantilla…"
              className="input-field pl-11"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((p) => (
              <div key={p.id} className="glass-shell animate-fade-up">
                <div className="glass-core flex h-full flex-col justify-between p-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-white/30">
                      <FileText size={16} weight="light" />
                      <span className="text-[10px] uppercase tracking-wider">{p.variables?.length || 0} variables</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-white">{p.nombre}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-white/50">{p.contenido}</p>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => { setEditando(p); setMostrarEditor(true); }}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
                    >
                      <PencilSimple size={13} weight="light" /> Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(p.id)}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-red-400"
                    >
                      <Trash size={13} weight="light" /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtradas.length === 0 && <p className="text-sm text-white/30">No hay plantillas todavía.</p>}
          </div>
        </>
      )}
    </div>
  );
}
