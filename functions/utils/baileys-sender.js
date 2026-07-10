const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const path = require('path');
const os = require('os');
const { descargarSesion, subirSesion } = require('./session-storage');

const AUTH_FOLDER = path.join(os.tmpdir(), 'baileys-auth');

let socketActivo = null;

// La sesión se vincula desde el botón "Vincular WhatsApp" del Dashboard
// (ver functions/index.js → iniciarPairingWhatsApp). Esta función solo
// descarga esa sesión ya autenticada desde Storage en cada cold start.
async function obtenerSocket() {
  if (socketActivo) return socketActivo;

  const hayCredenciales = await descargarSesion(AUTH_FOLDER);
  if (!hayCredenciales) {
    throw new Error('No hay sesión de WhatsApp vinculada. Vincúlala desde el Dashboard primero.');
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await subirSesion(AUTH_FOLDER);
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const debeReconectar =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      socketActivo = null;
      if (debeReconectar) obtenerSocket();
    }
  });

  socketActivo = sock;
  return sock;
}

async function enviarMensaje(telefono, texto, intentos = 3) {
  const sock = await obtenerSocket();
  const jid = `${telefono.replace('+', '')}@s.whatsapp.net`;

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      await sock.sendMessage(jid, { text: texto });
      return { exito: true };
    } catch (error) {
      if (intento === intentos) {
        return { exito: false, error: error.message };
      }
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
}

module.exports = { obtenerSocket, enviarMensaje };
