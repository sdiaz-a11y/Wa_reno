// Uso puntual: sube la sesión ya escaneada en scripts/baileys-session/
// a Firestore (colección _sistema, doc whatsapp_session), sin necesidad
// de volver a escanear el QR.
const path = require('path');
const AdmZip = require('adm-zip');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, 'serviceAccountKey.json'))),
});

const zip = new AdmZip();
zip.addLocalFolder(path.join(__dirname, 'baileys-session'));
const credsBase64 = zip.toBuffer().toString('base64');

admin
  .firestore()
  .collection('_sistema')
  .doc('whatsapp_session')
  .set({ credsBase64, actualizadoEn: new Date() })
  .then(() => {
    console.log(`✅ Sesión subida a Firestore (${(credsBase64.length / 1024).toFixed(1)} KB).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error subiendo sesión:', err.message);
    process.exit(1);
  });
