/**
 * TeamFlow — Proxy de Slack
 * ─────────────────────────────────────────────────────────────────────────────
 * Esta función corre en los servidores de Netlify, nunca en el browser.
 * Recibe { channel, text } desde el frontend y reenvía el mensaje a Slack
 * usando el bot token guardado de forma segura en las variables de entorno.
 *
 * Ruta pública:  POST /api/slack
 * Ruta interna:  /.netlify/functions/slack  (Netlify la mapea automáticamente)
 * ─────────────────────────────────────────────────────────────────────────────
 */

exports.handler = async (event) => {

  // ── Cabeceras CORS — permiten que el browser del usuario pueda llamar esta función ──
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // El browser siempre hace un preflight OPTIONS antes del POST real
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Solo aceptamos POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Leer el body enviado por el frontend ──
  let channel, text;
  try {
    const body = JSON.parse(event.body || '{}');
    channel = body.channel;
    text    = body.text;
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!channel || !text) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'channel y text son requeridos' }),
    };
  }

  // ── Token del bot — viene de la variable de entorno de Netlify ──
  const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

  if (!SLACK_BOT_TOKEN) {
    console.error('[TeamFlow] SLACK_BOT_TOKEN no está configurado en las variables de entorno de Netlify');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Slack token no configurado en el servidor' }),
    };
  }

  // ── Llamada real a la API de Slack (server-side, sin restricciones CORS) ──
  try {
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel, text }),
    });

    const data = await slackResponse.json();

    if (!data.ok) {
      console.error('[TeamFlow] Slack API error:', data.error, '| canal:', channel);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('[TeamFlow] Error llamando a Slack:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
