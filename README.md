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
