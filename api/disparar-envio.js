// Función serverless de Vercel (gratis en plan Hobby). El token de GitHub
// vive solo aquí, en variables de entorno del servidor — nunca llega al
// navegador. El botón "Enviar ahora" del frontend solo llama a este
// endpoint, que a su vez le pide a GitHub que corra el workflow.

import { createVerify } from 'crypto';

const FIREBASE_PROJECT_ID = 'wa-reno';
const CORREO_PERMITIDO = 'sdiaz@zigma3.com';

let certsCache = null;
let certsCacheHasta = 0;

async function obtenerCerts() {
  if (certsCache && Date.now() < certsCacheHasta) return certsCache;
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  certsCache = await resp.json();
  certsCacheHasta = Date.now() + 60 * 60 * 1000;
  return certsCache;
}

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verifica un ID token de Firebase Auth sin depender de firebase-admin
// (evita agregar dependencias nuevas al build de Vercel).
async function verificarIdToken(token) {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('Token con formato inválido');
  const [headerB64, payloadB64, firmaB64] = partes;

  const header = JSON.parse(base64urlDecode(headerB64).toString());
  const payload = JSON.parse(base64urlDecode(payloadB64).toString());

  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('aud inválido');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('iss inválido');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expirado');
  if (payload.email !== CORREO_PERMITIDO) throw new Error('Cuenta no autorizada');

  const certs = await obtenerCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Certificado desconocido (kid)');

  const verificador = createVerify('RSA-SHA256');
  verificador.update(`${headerB64}.${payloadB64}`);
  const valido = verificador.verify(cert, base64urlDecode(firmaB64));
  if (!valido) throw new Error('Firma inválida');

  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Falta autenticación' });
    return;
  }

  try {
    await verificarIdToken(token);
  } catch (err) {
    res.status(401).json({ error: `No autorizado: ${err.message}` });
    return;
  }

  const { GH_TOKEN, GH_REPO } = process.env;
  if (!GH_TOKEN || !GH_REPO) {
    res.status(500).json({ error: 'Falta configurar GH_TOKEN / GH_REPO en Vercel.' });
    return;
  }

  const resp = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/enviar-campanas.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (resp.status === 204) {
    res.status(200).json({ ok: true });
  } else {
    const texto = await resp.text();
    res.status(502).json({ error: `GitHub respondió ${resp.status}: ${texto}` });
  }
}
