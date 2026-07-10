const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const path = require('path');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getStorage } = require('firebase-admin/storage');

const SESSION_PATH_EN_STORAGE = 'whatsapp-session/creds.zip';
const AUTH_FOLDER = path.join(os.tmpdir(), 'baileys-auth');

let socketActivo = null;

// La sesión se vincula una sola vez desde scripts/pair-whatsapp.js (local,
// con QR). Esta función solo descarga esa sesión ya autenticada desde
// Storage en cada cold start y la vuelve a subir si Baileys renueva claves.
async function descargarSesion() {
  if (fs.existsSync(AUTH_FOLDER)) return;

  const bucket = getStorage().bucket();
  const [existe] = await bucket.file(SESSION_PATH_EN_STORAGE).exists();
  if (!existe) {
    throw new Error(
      'No hay sesión de WhatsApp vinculada. Corre scripts/pair-whatsapp.js localmente primero.'
    );
  }

  const zipPath = path.join(os.tmpdir(), 'creds.zip');
  await bucket.file(SESSION_PATH_EN_STORAGE).download({ destination: zipPath });
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  new AdmZip(zipPath).extractAllTo(AUTH_FOLDER, true);
}

async function subirSesion() {
  const zip = new AdmZip();
  zip.addLocalFolder(AUTH_FOLDER);
  const zipPath = path.join(os.tmpdir(), 'creds-out.zip');
  zip.writeZip(zipPath);
  await getStorage().bucket().upload(zipPath, { destination: SESSION_PATH_EN_STORAGE });
}

async function obtenerSocket() {
  if (socketActivo) return socketActivo;

  await descargarSesion();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await subirSesion();
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
