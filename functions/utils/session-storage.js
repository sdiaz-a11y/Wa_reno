const path = require('path');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getStorage } = require('firebase-admin/storage');

const SESSION_PATH_EN_STORAGE = 'whatsapp-session/creds.zip';

async function existeSesion() {
  const [existe] = await getStorage().bucket().file(SESSION_PATH_EN_STORAGE).exists();
  return existe;
}

async function descargarSesion(authFolder) {
  if (fs.existsSync(authFolder)) return true;

  const existe = await existeSesion();
  if (!existe) return false;

  const zipPath = path.join(os.tmpdir(), `creds-in-${Date.now()}.zip`);
  await getStorage().bucket().file(SESSION_PATH_EN_STORAGE).download({ destination: zipPath });
  fs.mkdirSync(authFolder, { recursive: true });
  new AdmZip(zipPath).extractAllTo(authFolder, true);
  fs.unlinkSync(zipPath);
  return true;
}

async function subirSesion(authFolder) {
  const zip = new AdmZip();
  zip.addLocalFolder(authFolder);
  const zipPath = path.join(os.tmpdir(), `creds-out-${Date.now()}.zip`);
  zip.writeZip(zipPath);
  await getStorage().bucket().upload(zipPath, { destination: SESSION_PATH_EN_STORAGE });
  fs.unlinkSync(zipPath);
}

async function borrarSesion() {
  const [existe] = await getStorage().bucket().file(SESSION_PATH_EN_STORAGE).exists();
  if (existe) await getStorage().bucket().file(SESSION_PATH_EN_STORAGE).delete();
}

module.exports = { existeSesion, descargarSesion, subirSesion, borrarSesion, SESSION_PATH_EN_STORAGE };
