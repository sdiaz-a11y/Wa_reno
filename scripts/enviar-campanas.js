// Corre esto manualmente cuando quieras disparar las campañas pendientes,
// sin necesitar Cloud Functions (plan Blaze). Usa la sesión de WhatsApp
// ya vinculada (guardada en Firestore) y el mismo límite de envíos que
// tendría la función en la nube.

const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const admin = require('firebase-admin');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const AUTH_FOLDER = path.join(__dirname, 'baileys-session');

const MAX_POR_HORA = 30;
const MAX_POR_DIA = 100;
const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 6000;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\nFalta scripts/serviceAccountKey.json.\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
const db = admin.firestore();

function delayAleatorio() {
  const ms = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((r) => setTimeout(r, ms));
}

function renderPlantilla(contenido, contacto) {
  return contenido.replace(/{{\s*nombre\s*}}/g, contacto.nombre || '');
}

function esTelefonoValido(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  const normalizado = digits.startsWith('52') && digits.length === 12 ? digits : digits.length === 10 ? `52${digits}` : null;
  return normalizado && !/^(\d)\1{4,}$/.test(normalizado.slice(2));
}

async function descargarSesionSiHaceFalta() {
  if (fs.existsSync(AUTH_FOLDER)) return;
  const doc = await db.collection('_sistema').doc('whatsapp_session').get();
  if (!doc.exists) {
    console.error('\nNo hay sesión de WhatsApp vinculada. Corre primero: npm run pair:web\n');
    process.exit(1);
  }
  const zipPath = path.join(os.tmpdir(), `creds-${Date.now()}.zip`);
  fs.writeFileSync(zipPath, Buffer.from(doc.data().credsBase64, 'base64'));
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  new AdmZip(zipPath).extractAllTo(AUTH_FOLDER, true);
  fs.unlinkSync(zipPath);
}

async function contarEnviosRecientes(userId, desde) {
  const snap = await db
    .collection('logs_envios')
    .where('userId', '==', userId)
    .where('estado', '==', 'enviado')
    .where('timestamp', '>=', desde)
    .get();
  return snap.size;
}

async function procesarCampana(sock, campanaDoc) {
  const campana = campanaDoc.data();
  const campanaRef = campanaDoc.ref;
  console.log(`\nProcesando campaña ${campanaDoc.id} (${campana.contactosIds.length} contactos)…`);
  await campanaRef.update({ estado: 'en_proceso' });

  try {
    const plantillaSnap = await db.collection('plantillas').doc(campana.plantillaId).get();
    if (!plantillaSnap.exists) {
      await campanaRef.update({ estado: 'error', error: 'Plantilla no encontrada' });
      return;
    }
    const plantilla = plantillaSnap.data();
    let enviados = 0;
    let fallidos = 0;

    for (const contactoId of campana.contactosIds) {
      const inicioHora = new Date(Date.now() - 60 * 60 * 1000);
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);

      const [enviosHora, enviosDia] = await Promise.all([
        contarEnviosRecientes(campana.userId, inicioHora),
        contarEnviosRecientes(campana.userId, inicioDia),
      ]);

      if (enviosHora >= MAX_POR_HORA || enviosDia >= MAX_POR_DIA) {
        console.log('  Límite de envíos alcanzado, se detiene aquí (corre el script de nuevo más tarde).');
        break;
      }

      const contactoSnap = await db.collection('contactos').doc(contactoId).get();
      const contacto = contactoSnap.data();

      if (!contacto || !esTelefonoValido(contacto.telefono)) {
        fallidos++;
        await db.collection('logs_envios').add({
          campaniaId: campanaRef.id,
          telefonoDestino: contacto?.telefono || null,
          plantillaId: campana.plantillaId,
          estado: 'fallido',
          mensaje: null,
          error: 'Número inválido o contacto no encontrado',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          userId: campana.userId,
        });
        continue;
      }

      const mensaje = renderPlantilla(plantilla.contenido, contacto);
      let exito = true;
      let error = null;
      try {
        const numeroSinMas = contacto.telefono.replace('+', '');
        const [resultado] = await sock.onWhatsApp(numeroSinMas);
        if (!resultado?.exists) {
          throw new Error('Ese número no tiene WhatsApp activo.');
        }
        await sock.sendMessage(resultado.jid, { text: mensaje });
        console.log(`  ✅ Enviado a ${contacto.nombre} (${contacto.telefono})`);
      } catch (e) {
        exito = false;
        error = e.message;
        console.log(`  ❌ Falló ${contacto.nombre}: ${e.message}`);
      }

      await db.collection('logs_envios').add({
        campaniaId: campanaRef.id,
        telefonoDestino: contacto.telefono,
        plantillaId: campana.plantillaId,
        estado: exito ? 'enviado' : 'fallido',
        mensaje,
        error,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: campana.userId,
      });

      exito ? enviados++ : fallidos++;
      await delayAleatorio();
    }

    const pendientes = campana.contactosIds.length - enviados - fallidos;
    await campanaRef.update({
      estado: pendientes > 0 ? 'pendiente' : 'completado',
      resultados: { enviados, fallidos, pendientes },
      ejecutadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Resumen: ${enviados} enviados, ${fallidos} fallidos, ${pendientes} pendientes.`);
  } catch (error) {
    await campanaRef.update({ estado: 'error', error: error.message });
    console.error('  Error procesando campaña:', error.message);
  }
}

async function main() {
  await descargarSesionSiHaceFalta();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);

  await new Promise((resolve, reject) => {
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') resolve();
      if (update.connection === 'close') reject(new Error('No se pudo conectar. ¿Sigue vinculada la sesión?'));
    });
  });

  console.log('Conectado a WhatsApp. Buscando campañas pendientes…');

  const snap = await db
    .collection('campanas')
    .where('estado', '==', 'pendiente')
    .where('fechaProgramada', '<=', new Date())
    .get();

  if (snap.empty) {
    console.log('No hay campañas pendientes por enviar en este momento.');
  } else {
    for (const campanaDoc of snap.docs) {
      await procesarCampana(sock, campanaDoc);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
