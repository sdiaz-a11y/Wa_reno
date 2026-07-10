// Igual que pair-whatsapp.js, pero muestra el QR en una página web local
// (http://localhost:5050) en vez de dibujarlo en la terminal. Requiere
// scripts/serviceAccountKey.json (ver README) y sube la sesión a Firestore
// automáticamente al escanear (no usa Storage: requiere plan Blaze).

const path = require('path');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');
const QRCode = require('qrcode');
const admin = require('firebase-admin');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const AUTH_FOLDER_LOCAL = path.join(__dirname, 'baileys-session');
const PUERTO = 5050;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    '\nFalta scripts/serviceAccountKey.json.\n' +
      'Descárgalo en: Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.\n'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

let estado = { tipo: 'esperando' };

function paginaHtml() {
  const cuerpo =
    estado.tipo === 'qr'
      ? `<img src="${estado.dataUrl}" alt="QR" style="width:320px;height:320px" />
         <p>Escanea con WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</p>
         <script>setTimeout(() => location.reload(), 3000)</script>`
      : estado.tipo === 'conectado'
      ? `<h1 style="color:#22c55e">✅ WhatsApp vinculado correctamente</h1>
         <p>Ya puedes cerrar esta ventana y la terminal.</p>`
      : estado.tipo === 'error'
      ? `<h1 style="color:#ef4444">❌ ${estado.mensaje}</h1>`
      : `<p>Generando código…</p><script>setTimeout(() => location.reload(), 1500)</script>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Vincular WhatsApp</title>
    <style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;
    align-items:center;justify-content:center;min-height:100vh;text-align:center;gap:1rem}</style></head>
    <body>${cuerpo}</body></html>`;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(paginaHtml());
});

server.listen(PUERTO, () => {
  const url = `http://localhost:${PUERTO}`;
  console.log(`\nAbriendo ${url} en tu navegador…\n`);
  exec(`start "" "${url}"`);
});

async function subirSesion() {
  const zip = new AdmZip();
  zip.addLocalFolder(AUTH_FOLDER_LOCAL);
  const credsBase64 = zip.toBuffer().toString('base64');
  await admin.firestore().collection('_sistema').doc('whatsapp_session').set({
    credsBase64,
    actualizadoEn: new Date(),
  });
}

const MAX_REINTENTOS = 5;

async function iniciar(intento = 1) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER_LOCAL);
  const sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      estado = { tipo: 'qr', dataUrl: await QRCode.toDataURL(qr, { width: 320, margin: 1 }) };
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp vinculado correctamente.');
      await subirSesion();
      estado = { tipo: 'conectado' };
      setTimeout(() => process.exit(0), 3000);
    }

    if (connection === 'close') {
      const debeReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (debeReconectar && intento < MAX_REINTENTOS) {
        setTimeout(() => iniciar(intento + 1), 2000);
      } else if (debeReconectar) {
        estado = { tipo: 'error', mensaje: 'No se pudo conectar tras varios intentos.' };
      } else {
        estado = { tipo: 'error', mensaje: 'Sesión cerrada. Borra scripts/baileys-session y reintenta.' };
      }
    }
  });
}

iniciar();
