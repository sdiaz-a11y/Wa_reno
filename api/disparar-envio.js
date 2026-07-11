// Función serverless de Vercel (gratis en plan Hobby). El token de GitHub
// vive solo aquí, en variables de entorno del servidor — nunca llega al
// navegador. El botón "Enviar ahora" del frontend solo llama a este
// endpoint, que a su vez le pide a GitHub que corra el workflow.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
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
