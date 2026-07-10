import { useMemo, useState } from 'react';
import { WarningCircle, PaperPlaneTilt, CheckCircle } from 'phosphor-react';
import { validarCampana } from '../services/validaciones';

export default function SchedulerCampana({ plantillas, contactos, mensajesHoy, hayActiva, onCrear }) {
  const [plantillaId, setPlantillaId] = useState('');
  const [modoContactos, setModoContactos] = useState('todos');
  const [contactosIds, setContactosIds] = useState([]);
  const [fecha, setFecha] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const idsFinales = modoContactos === 'todos' ? contactos.map((c) => c.id) : contactosIds;
  const plantilla = plantillas.find((p) => p.id === plantillaId);

  const validacion = useMemo(
    () => validarCampana({ plantillaId, contactosIds: idsFinales, fechaProgramada: fecha, mensajesHoy }),
    [plantillaId, idsFinales, fecha, mensajesHoy]
  );

  function toggleContacto(id) {
    setContactosIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleConfirmar() {
    await onCrear({ plantillaId, contactosIds: idsFinales, fechaProgramada: new Date(fecha) });
    setConfirmando(false);
    setPlantillaId('');
    setContactosIds([]);
    setFecha('');
  }

  return (
    <div className="glass-shell animate-fade-up">
      <div className="glass-core space-y-5 p-6 sm:p-8">
        {hayActiva && (
          <p className="flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-400">
            <WarningCircle size={14} weight="light" /> Ya tienes una campaña activa. No se permiten campañas simultáneas.
          </p>
        )}

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Plantilla</label>
          <select
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
            className="input-field appearance-none"
          >
            <option value="">Selecciona una plantilla…</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {plantilla && <p className="mt-2 text-xs text-white/40">{plantilla.contenido}</p>}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Contactos</label>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setModoContactos('todos')}
              className={`rounded-full px-4 py-2 text-xs transition-colors duration-300 ${modoContactos === 'todos' ? 'bg-emerald-glow/90 text-black' : 'bg-white/5 text-white/50'}`}
            >
              Todos ({contactos.length})
            </button>
            <button
              type="button"
              onClick={() => setModoContactos('especificos')}
              className={`rounded-full px-4 py-2 text-xs transition-colors duration-300 ${modoContactos === 'especificos' ? 'bg-emerald-glow/90 text-black' : 'bg-white/5 text-white/50'}`}
            >
              Específicos
            </button>
          </div>
          {modoContactos === 'especificos' && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-3">
              {contactos.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={contactosIds.includes(c.id)}
                    onChange={() => toggleContacto(c.id)}
                    className="h-4 w-4 rounded accent-emerald-glow"
                  />
                  {c.nombre} <span className="text-white/30">{c.telefono}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Fecha y hora</label>
          <input
            type="datetime-local"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="input-field"
          />
        </div>

        <p className="text-xs text-white/30">Mensajes enviados hoy: {mensajesHoy}/100</p>

        {validacion.errores.map((e, i) => (
          <p key={i} className="flex items-center gap-2 text-xs text-red-400">
            <WarningCircle size={14} weight="light" /> {e}
          </p>
        ))}
        {validacion.advertencias.map((a, i) => (
          <p key={i} className="flex items-center gap-2 text-xs text-amber-400">
            <WarningCircle size={14} weight="light" /> {a}
          </p>
        ))}

        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={!validacion.valido || hayActiva}
            className="group btn-pill disabled:opacity-40"
          >
            Programar campaña
            <span className="btn-pill-icon">
              <PaperPlaneTilt size={14} weight="bold" />
            </span>
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-emerald-glow/20 bg-emerald-glow/5 p-5">
            <p className="text-sm text-white/80">
              Enviarás <span className="text-emerald-glow">{idsFinales.length}</span> mensajes el{' '}
              {fecha && new Date(fecha).toLocaleString('es-MX')}.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={handleConfirmar} className="group btn-pill">
                Confirmar
                <span className="btn-pill-icon"><CheckCircle size={14} weight="bold" /></span>
              </button>
              <button onClick={() => setConfirmando(false)} className="text-xs text-white/40 hover:text-white/70">
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
