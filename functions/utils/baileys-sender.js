const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const path = require('path');
const os = require('os');

let socketActivo = null;

// Sesión persistida localmente en cold start; en producción respaldar
// el contenido de authFolder en Firebase Storage (encriptado) entre invocaciones.
async function obtenerSocket() {
  if (socketActivo) return socketActivo;

  const authFolder = path.join(os.tmpdir(), 'baileys-auth');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({ auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);

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
