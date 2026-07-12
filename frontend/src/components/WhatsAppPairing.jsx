import { useRef, useState } from 'react';
import { WhatsappLogo, CheckCircle, WarningCircle, X } from 'phosphor-react';
import { auth } from '../services/firebase';

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_URL;

export default function WhatsAppPairing() {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState('idle'); // idle | esperando | qr | conectado | error
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  async function iniciarPairing() {
    setAbierto(true);
    setEstado('esperando');
    setError('');
    setQrDataUrl(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await auth.currentUser.getIdToken();
      const resp = await fetch(`${FUNCTIONS_BASE_URL}/iniciarPairingWhatsApp`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!resp.body) throw new Error('El navegador no soporta streaming.');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const linea = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!linea.trim()) continue;

          const evento = JSON.parse(linea);
          if (evento.tipo === 'qr') {
            setQrDataUrl(evento.dataUrl);
            setEstado('qr');
          } else if (evento.tipo === 'conectado') {
            setEstado('conectado');
          } else if (evento.tipo === 'error') {
            setEstado('error');
            setError(evento.mensaje);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setEstado('error');
        setError('No se pudo conectar. Esta función requiere el plan Blaze de Firebase (Cloud Functions) — usa scripts/pair-whatsapp-web.js mientras tanto.');
      }
    }
  }

  function cerrar() {
    abortRef.current?.abort();
    setAbierto(false);
    setEstado('idle');
  }

  return (
    <>
      <button onClick={iniciarPairing} className="group btn-pill">
        Vincular WhatsApp
        <span className="btn-pill-icon">
          <WhatsappLogo size={14} weight="bold" />
        </span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4 backdrop-blur-2xl">
          <div className="glass-shell w-full max-w-sm animate-fade-up">
            <div className="glass-core relative flex flex-col items-center gap-5 p-8 text-center">
              <button onClick={cerrar} className="absolute right-4 top-4 text-white/30 hover:text-white">
                <X size={16} weight="light" />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-glow/10 ring-1 ring-emerald-glow/30">
                <WhatsappLogo size={18} weight="light" className="text-emerald-glow" />
              </div>

              {estado === 'esperando' && (
                <>
                  <p className="text-sm text-white/60">Generando código…</p>
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-glow" />
                </>
              )}

              {estado === 'qr' && qrDataUrl && (
                <>
                  <p className="text-sm text-white/60">
                    Escanea con WhatsApp → Ajustes → Dispositivos vinculados
                  </p>
                  <div className="rounded-2xl bg-white p-3">
                    <img src={qrDataUrl} alt="Código QR de WhatsApp" className="h-56 w-56" />
                  </div>
                  <p className="text-[11px] text-white/30">El código expira en poco más de un minuto.</p>
                </>
              )}

              {estado === 'conectado' && (
                <>
                  <CheckCircle size={40} weight="light" className="text-emerald-glow" />
                  <p className="text-sm text-white/80">WhatsApp vinculado correctamente.</p>
                  <button onClick={cerrar} className="btn-pill">Listo</button>
                </>
              )}

              {estado === 'error' && (
                <>
                  <WarningCircle size={32} weight="light" className="text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                  <button onClick={iniciarPairing} className="btn-pill">Reintentar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
