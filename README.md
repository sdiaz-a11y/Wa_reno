# Wasend — Plataforma de envío de WhatsApp

## Deploy en Vercel

Este repo tiene `vercel.json` en la raíz configurado para construir el proyecto que vive en `frontend/`. Al importar el repo en Vercel:

1. Framework detectado: **Vite** (por `vercel.json`, no requiere configurar Root Directory manualmente).
2. Agrega estas **Environment Variables** en el proyecto de Vercel (Settings → Environment Variables), usando los valores de tu proyecto de Firebase:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FUNCTIONS_URL   (ej. https://us-central1-wa-reno.cloudfunctions.net)
```

Sin estas variables, el login y el resto de la app no podrán conectar con Firebase (pantalla en blanco o errores de auth). Sin `VITE_FUNCTIONS_URL`, el botón "Vincular WhatsApp" del Dashboard no funcionará.

3. Cada push a `main` dispara un deploy automático.

## Backend (Cloud Functions)

El backend (`functions/`) se despliega por separado con Firebase CLI, no por Vercel:

```
firebase login
firebase deploy --only functions,firestore:rules
```

**Nota:** desplegar Cloud Functions (incluida `iniciarPairingWhatsApp` y el
scheduler de campañas) requiere que el proyecto esté en el plan **Blaze**
(pago por uso; capa gratuita generosa). Sin Blaze, el botón "Vincular
WhatsApp" del Dashboard no funciona — usa en su lugar los scripts locales.

## Vincular WhatsApp sin Blaze (scripts locales)

La sesión de WhatsApp se guarda en Firestore (colección `_sistema`, doc
`whatsapp_session`), no en Storage — Storage también requiere Blaze.

1. Descarga `scripts/serviceAccountKey.json` desde Firebase Console →
   Configuración del proyecto → Cuentas de servicio → Generar nueva clave
   privada (el archivo queda ignorado por git).
2. `cd scripts && npm install`
3. `npm run pair:web` (abre una página en tu navegador con el QR) o
   `npm run pair` (QR en la terminal).
4. Escanea con WhatsApp → Ajustes → Dispositivos vinculados.

La sesión sólo debe vincularse una vez; queda activa indefinidamente salvo
que la desvincules manualmente desde el celular.
