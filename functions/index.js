const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enviarMensaje } = require('./utils/baileys-sender');
const { esTelefonoValido } = require('./utils/validaciones');
const { manejarPairing } = require('./utils/pairing');

initializeApp();
const db = getFirestore();

exports.iniciarPairingWhatsApp = onRequest(
  { timeoutSeconds: 90, memory: '512MiB', cors: true },
  manejarPairing
);

const MAX_POR_HORA = 20;
const MAX_POR_DIA = 100;
const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 6000;

function delayAleatorio() {
  const ms = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((r) => setTimeout(r, ms));
}

function renderPlantilla(contenido, contacto) {
  return contenido.replace(/{{\s*nombre\s*}}/g, contacto.nombre || '');
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

async function procesarCampana(campanaDoc) {
  const campana = campanaDoc.data();
  const campanaRef = campanaDoc.ref;

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

      const enviosHora = await contarEnviosRecientes(campana.userId, inicioHora);
      const enviosDia = await contarEnviosRecientes(campana.userId, inicioDia);

      if (enviosHora >= MAX_POR_HORA || enviosDia >= MAX_POR_DIA) {
        await db.collection('logs_envios').add({
          campaniaId: campanaRef.id,
          telefonoDestino: null,
          plantillaId: campana.plantillaId,
          estado: 'pendiente',
          mensaje: null,
          error: 'Rate limit alcanzado, reintentar en próxima ejecución',
          timestamp: FieldValue.serverTimestamp(),
          userId: campana.userId,
        });
        continue;
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
          timestamp: FieldValue.serverTimestamp(),
          userId: campana.userId,
        });
        continue;
      }

      const mensaje = renderPlantilla(plantilla.contenido, contacto);
      const resultado = await enviarMensaje(contacto.telefono, mensaje);

      await db.collection('logs_envios').add({
        campaniaId: campanaRef.id,
        telefonoDestino: contacto.telefono,
        plantillaId: campana.plantillaId,
        estado: resultado.exito ? 'enviado' : 'fallido',
        mensaje,
        error: resultado.exito ? null : resultado.error,
        timestamp: FieldValue.serverTimestamp(),
        userId: campana.userId,
      });

      resultado.exito ? enviados++ : fallidos++;
      await delayAleatorio();
    }

    await campanaRef.update({
      estado: 'completado',
      resultados: { enviados, fallidos, pendientes: 0 },
      ejecutadoEn: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await campanaRef.update({ estado: 'error', error: error.message });
  }
}

exports.procesarCampanasPendientes = onSchedule('every 5 minutes', async () => {
  const ahora = FieldValue.serverTimestamp();
  const snap = await db
    .collection('campanas')
    .where('estado', '==', 'pendiente')
    .where('fechaProgramada', '<=', new Date())
    .get();

  for (const campanaDoc of snap.docs) {
    await procesarCampana(campanaDoc);
  }
});
