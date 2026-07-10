const path = require('path');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getFirestore } = require('firebase-admin/firestore');

// Guardamos la sesión de WhatsApp (comprimida en zip, codificada en base64)
// dentro de un documento de Firestore en vez de Firebase Storage, porque
// Storage ahora requiere el plan Blaze (pago) y esto cabe cómodo dentro
// del límite de 1MB por documento de Firestore (plan Spark, gratis).
const COLECCION = '_sistema';
const DOC_ID = 'whatsapp_session';

async function existeSesion() {
  const doc = await getFirestore().collection(COLECCION).doc(DOC_ID).get();
  return doc.exists;
}

async function descargarSesion(authFolder) {
  if (fs.existsSync(authFolder)) return true;

  const doc = await getFirestore().collection(COLECCION).doc(DOC_ID).get();
  if (!doc.exists) return false;

  const zipPath = path.join(os.tmpdir(), `creds-in-${Date.now()}.zip`);
  fs.writeFileSync(zipPath, Buffer.from(doc.data().credsBase64, 'base64'));
  fs.mkdirSync(authFolder, { recursive: true });
  new AdmZip(zipPath).extractAllTo(authFolder, true);
  fs.unlinkSync(zipPath);
  return true;
}

async function subirSesion(authFolder) {
  const zip = new AdmZip();
  zip.addLocalFolder(authFolder);
  const credsBase64 = zip.toBuffer().toString('base64');
  await getFirestore().collection(COLECCION).doc(DOC_ID).set({
    credsBase64,
    actualizadoEn: new Date(),
  });
}

async function borrarSesion() {
  await getFirestore().collection(COLECCION).doc(DOC_ID).delete();
}

module.exports = { existeSesion, descargarSesion, subirSesion, borrarSesion };
