const path = require('path');
const os = require('os');
const fs = require('fs');
const QRCode = require('qrcode');
const { getAuth } = require('firebase-admin/auth');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { subirSesion, borrarSesion } = require('./session-storage');

const TIEMPO_LIMITE_MS = 75 * 1000;

async function verificarAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('No autenticado');
  return getAuth().verifyIdToken(token);
}

// Streaming NDJSON: cada línea es un evento { tipo, ... } que el frontend
// va leyendo a medida que llega, sin esperar a que la respuesta termine.
async function manejarPairing(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    await verificarAuth(req);
  } catch {
    res.status(401).json({ tipo: 'error', mensaje: 'No autenticado' });
    return;
  }

  res.set('Content-Type', 'application/x-ndjson');
  res.status(200);

  const authFolder = path.join(os.tmpdir(), `baileys-pairing-${Date.now()}`);
  await borrarSesion();

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const sock = makeWASocket({ auth: state });

  let terminado = false;
  const enviar = (obj) => {
    if (terminado) return;
    res.write(JSON.stringify(obj) + '\n');
  };
  const finalizar = (obj) => {
    if (terminado) return;
    terminado = true;
    enviar(obj);
    res.end();
    clearTimeout(timeoutId);
    try {
      sock.end();
    } catch {}
    fs.rmSync(authFolder, { recursive: true, force: true });
  };

  const timeoutId = setTimeout(() => {
    finalizar({ tipo: 'error', mensaje: 'El código expiró. Intenta de nuevo.' });
  }, TIEMPO_LIMITE_MS);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      enviar({ tipo: 'qr', dataUrl });
    }

    if (connection === 'open') {
      await subirSesion(authFolder);
      finalizar({ tipo: 'conectado' });
    }

    if (connection === 'close') {
      const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (!debeReconectar) {
        finalizar({ tipo: 'error', mensaje: 'Sesión cerrada, intenta de nuevo.' });
      }
      // si debeReconectar, Baileys reintenta solo y eventualmente emite un
      // nuevo 'qr' o 'open'; no cerramos la respuesta todavía.
    }
  });

  req.on('close', () => {
    clearTimeout(timeoutId);
    if (!terminado) {
      terminado = true;
      try {
        sock.end();
      } catch {}
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
  });
}

module.exports = { manejarPairing };
