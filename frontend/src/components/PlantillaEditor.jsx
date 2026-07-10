import { useMemo, useState } from 'react';
import { WarningCircle, CheckCircle, FloppyDisk } from 'phosphor-react';
import { validarPlantilla, renderPreview, extraerVariables } from '../services/validaciones';

export default function PlantillaEditor({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [contenido, setContenido] = useState(inicial?.contenido || '');
  const [previewValores, setPreviewValores] = useState({});

  const variablesDeclaradas = useMemo(() => extraerVariables(contenido), [contenido]);
  const validacion = useMemo(
    () => validarPlantilla({ nombre, contenido, variablesDeclaradas }),
    [nombre, contenido, variablesDeclaradas]
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!validacion.valido) return;
    onGuardar({ nombre: nombre.trim(), contenido: contenido.trim(), variables: variablesDeclaradas });
  }

  return (
    <form onSubmit={handleSubmit} className="glass-shell animate-fade-up">
      <div className="glass-core space-y-5 p-6 sm:p-8">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Recordatorio de cita"
            className="input-field"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-white/40">Contenido</label>
            <span className={`text-[11px] ${contenido.length > 160 ? 'text-amber-400' : 'text-white/30'}`}>
              {contenido.length}/160
            </span>
          </div>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={4}
            placeholder="Hola {{nombre}}, te esperamos el {{fecha}} a las {{hora}}."
            className="input-field resize-none"
          />
          {variablesDeclaradas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {variablesDeclaradas.map((v) => (
                <span key={v} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {variablesDeclaradas.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Preview</label>
            <div className="grid grid-cols-2 gap-2">
              {variablesDeclaradas.map((v) => (
                <input
                  key={v}
                  placeholder={v}
                  value={previewValores[v] || ''}
                  onChange={(e) => setPreviewValores((p) => ({ ...p, [v]: e.target.value }))}
                  className="input-field text-xs"
                />
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm text-white/80">
              {renderPreview(contenido, previewValores)}
            </div>
          </div>
        )}

        {validacion.errores.length > 0 && (
          <div className="space-y-1.5">
            {validacion.errores.map((e, i) => (
              <p key={i} className="flex items-center gap-2 text-xs text-red-400">
                <WarningCircle size={14} weight="light" /> {e}
              </p>
            ))}
          </div>
        )}
        {validacion.advertencias.length > 0 && (
          <div className="space-y-1.5">
            {validacion.advertencias.map((a, i) => (
              <p key={i} className="flex items-center gap-2 text-xs text-amber-400">
                <WarningCircle size={14} weight="light" /> {a}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={!validacion.valido} className="group btn-pill disabled:opacity-40">
            Guardar plantilla
            <span className="btn-pill-icon">
              <FloppyDisk size={14} weight="bold" />
            </span>
          </button>
          {onCancelar && (
            <button type="button" onClick={onCancelar} className="text-xs text-white/40 hover:text-white/70">
              Cancelar
            </button>
          )}
          {validacion.valido && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-glow">
              <CheckCircle size={14} weight="light" /> Lista para guardar
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
