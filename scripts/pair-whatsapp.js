// Ejecutar UNA sola vez desde tu computadora para vincular WhatsApp.
// Genera un QR en la terminal; al escanearlo, sube la sesión cifrada
// a Firebase Storage para que la Cloud Function la reutilice sin
// volver a pedir QR en cada ejecución.

const path = require('path');
const fs = require('fs');
const os = require('os');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
const AdmZip = require('adm-zip');
const qrcodeTerminal = require('qrcode-terminal');
const admin = require('firebase-admin');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const STORAGE_BUCKET = 'wa-reno.firebasestorage.app';
const SESSION_PATH_EN_STORAGE = 'whatsapp-session/creds.zip';
const AUTH_FOLDER_LOCAL = path.join(__dirname, 'baileys-session');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    '\nFalta scripts/serviceAccountKey.json.\n' +
      'Descárgalo en: Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.\n'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  storageBucket: STORAGE_BUCKET,
});

async function subirSesion() {
  const zip = new AdmZip();
  zip.addLocalFolder(AUTH_FOLDER_LOCAL);
  const zipPath = path.join(os.tmpdir(), 'creds.zip');
  zip.writeZip(zipPath);

  await admin.storage().bucket().upload(zipPath, { destination: SESSION_PATH_EN_STORAGE });
  console.log('\n✅ Sesión subida a Firebase Storage. Ya puedes desplegar la Cloud Function.\n');
}

const MAX_REINTENTOS = 5;

async function iniciar(intento = 1) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER_LOCAL);
  const sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nEscanea este QR con WhatsApp (Dispositivos vinculados → Vincular dispositivo):\n');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp vinculado correctamente.');
      await subirSesion();
      process.exit(0);
    }

    if (connection === 'close') {
      const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (debeReconectar && intento < MAX_REINTENTOS) {
        console.log(`Conexión cerrada, reintentando… (${intento}/${MAX_REINTENTOS})`);
        setTimeout(() => iniciar(intento + 1), 2000);
      } else if (debeReconectar) {
        console.error('\nNo se pudo establecer la conexión tras varios intentos. Revisa tu red/firewall e inténtalo de nuevo.');
        process.exit(1);
      } else {
        console.log('Sesión cerrada (logged out). Borra scripts/baileys-session y vuelve a correr el script.');
        process.exit(1);
      }
    }
  });
}

iniciar();
