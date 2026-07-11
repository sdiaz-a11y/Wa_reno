import { useState } from 'react';
import Papa from 'papaparse';
import { UploadSimple, WarningCircle, CheckCircle } from 'phosphor-react';
import { validarArchivoCsv, validarFilaCsv } from '../services/validaciones';

const NUEVA_LISTA = '__nueva__';

export default function CargadorContactos({ existentes = [], listas = [], onImportarLote }) {
  const [listaSeleccionada, setListaSeleccionada] = useState('');
  const [nombreNuevaLista, setNombreNuevaLista] = useState('');
  const [preview, setPreview] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [progreso, setProgreso] = useState(0);
  const [importando, setImportando] = useState(false);

  const creandoNuevaLista = listaSeleccionada === NUEVA_LISTA;
  const nombreListaFinal = creandoNuevaLista ? nombreNuevaLista.trim() : listas.find((l) => l.id === listaSeleccionada)?.nombre;
  const listaLista = creandoNuevaLista ? nombreNuevaLista.trim().length > 0 : Boolean(listaSeleccionada);

  function handleFile(e) {
    const file = e.target.files?.[0];
    setErrorArchivo('');
    setPreview(null);
    if (!file) return;

    const archivoCheck = validarArchivoCsv(file);
    if (!archivoCheck.valido) {
      setErrorArchivo(archivoCheck.errores.join(' '));
      return;
    }

    Papa.parse(file, {
      encoding: 'UTF-8',
      skipEmptyLines: true,
      complete: (results) => {
        const filas = results.data;

        if (results.errors.length > 0) {
          setErrorArchivo(`Error leyendo el CSV: ${results.errors[0].message}`);
          return;
        }
        if (filas.length === 0) {
          setErrorArchivo('El archivo se leyó pero no contiene filas. Verifica que no esté vacío y que use comas como separador.');
          return;
        }

        // Duplicados solo cuentan dentro de la misma lista; el mismo número
        // puede existir en listas distintas.
        const telefonosExistentes = new Set(
          existentes.filter((c) => c.listaId === listaSeleccionada).map((c) => c.telefono)
        );
        const vistosEnImport = new Set();

        const validas = [];
        const errores = [];
        let duplicadosImport = 0;
        let duplicadosDb = 0;

        filas.forEach((row, i) => {
          const check = validarFilaCsv(row, i);
          if (!check.valida) {
            errores.push(...check.errores);
            return;
          }
          if (vistosEnImport.has(check.telefono)) {
            duplicadosImport++;
            return;
          }
          if (telefonosExistentes.has(check.telefono)) {
            duplicadosDb++;
            return;
          }
          vistosEnImport.add(check.telefono);
          validas.push({ nombre: check.nombre, telefono: check.telefono });
        });

        setPreview({ validas, errores, duplicadosImport, duplicadosDb, total: filas.length });
      },
      error: (err) => {
        console.error('[CSV] error fatal de Papa.parse:', err);
        setErrorArchivo(`No se pudo leer el archivo: ${err.message}`);
      },
    });
  }

  async function handleConfirmar() {
    if (!preview?.validas?.length || !listaLista) return;
    setImportando(true);
    setProgreso(0);
    await onImportarLote(preview.validas, {
      listaId: creandoNuevaLista ? null : listaSeleccionada,
      nombreLista: nombreListaFinal,
    });
    setProgreso(100);
    setImportando(false);
    setPreview(null);
  }

  return (
    <div className="glass-shell animate-fade-up">
      <div className="glass-core space-y-5 p-6 sm:p-8">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Lista de contactos</label>
          <select
            value={listaSeleccionada}
            onChange={(e) => setListaSeleccionada(e.target.value)}
            className="input-field appearance-none"
          >
            <option value="">Selecciona una lista…</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
            <option value={NUEVA_LISTA}>+ Crear nueva lista…</option>
          </select>
          {creandoNuevaLista && (
            <input
              value={nombreNuevaLista}
              onChange={(e) => setNombreNuevaLista(e.target.value)}
              placeholder="Nombre de la nueva lista (ej. Clientes Synergy 2025)"
              className="input-field mt-2"
            />
          )}
        </div>

        <label
          className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition-colors duration-300 ${
            listaLista ? 'cursor-pointer hover:border-emerald-glow/40' : 'cursor-not-allowed opacity-40'
          }`}
        >
          <UploadSimple size={22} weight="light" className="text-white/40" />
          <span className="text-sm text-white/60">
            {listaLista ? 'Arrastra tu CSV o haz clic para elegir' : 'Elige o crea una lista primero'}
          </span>
          <span className="text-[11px] text-white/30">Columnas: nombre, teléfono · máx 5MB</span>
          <input type="file" accept=".csv,.xlsx" onChange={handleFile} disabled={!listaLista} className="hidden" />
        </label>

        {errorArchivo && (
          <p className="flex items-center gap-2 text-xs text-red-400">
            <WarningCircle size={14} weight="light" /> {errorArchivo}
          </p>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm text-white/70">
              Importarás <span className="text-emerald-glow">{preview.validas.length}</span> contactos nuevos a{' '}
              <span className="text-emerald-glow">{nombreListaFinal}</span>
              {preview.duplicadosImport + preview.duplicadosDb > 0 && (
                <>, {preview.duplicadosImport + preview.duplicadosDb} duplicados</>
              )}
              .
            </div>

            {preview.errores.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {preview.errores.map((e, i) => (
                  <p key={i} className="flex items-center gap-2 text-xs text-red-400">
                    <WarningCircle size={12} weight="light" /> {e}
                  </p>
                ))}
              </div>
            )}

            {importando && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-emerald-glow transition-all duration-500 ease-fluid"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmar}
                disabled={importando || preview.validas.length === 0}
                className="group btn-pill disabled:opacity-40"
              >
                {importando ? `Importando… ${progreso}%` : 'Confirmar importación'}
                <span className="btn-pill-icon">
                  <CheckCircle size={14} weight="bold" />
                </span>
              </button>
              <button onClick={() => setPreview(null)} className="text-xs text-white/40 hover:text-white/70">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
