/**
 * TeamFlow — Reportes automáticos programados
 * ─────────────────────────────────────────────────────────────────────────────
 * Esta función corre en los servidores de Netlify según el horario configurado
 * en Firebase. No depende de que nadie tenga el browser abierto.
 *
 * Se activa via POST desde el cron de Netlify (netlify.toml)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FIREBASE_URL = 'https://teamflow-67eff-default-rtdb.firebaseio.com';

// ── Helpers ──
const fmtTs = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fullDate = ts => !ts ? 'Sin fecha' : new Date(ts).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

// ── Leer datos de Firebase via REST ──
const fbGet = async (path) => {
  const r = await fetch(`${FIREBASE_URL}/${path}.json`);
  return r.json();
};

const fbSet = async (path, data) => {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

// ── Enviar mensaje a Slack ──
const postSlack = async (channel, text) => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !channel || !text) return;
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text }),
  });
  const d = await r.json();
  if (!d.ok) console.error('[Reports] Slack error:', d.error);
};

// ── Construir reporte matutino ──
const buildMorning = (tasks, users) => {
  const n = Date.now();
  const lines = [
    `📊 *Reporte Matutino — ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}*`,
    '━━━━━━━━━━━━━━━━',
  ];
  users.forEach(u => {
    const ut = tasks.filter(t => t.assignedTo === u);
    lines.push(
      `👤 *${u}*: 🟢 ${ut.filter(t => (t.noExpiry || t.dueTimestamp >= n) && t.status !== 'completed').length} vigentes  |  ` +
      `🔴 ${ut.filter(t => !t.noExpiry && t.dueTimestamp < n && t.status !== 'completed').length} vencidas  |  ` +
      `✅ ${ut.filter(t => t.status === 'completed').length} completadas`
    );
  });
  return lines.join('\n');
};

// ── Construir reporte vespertino ──
const buildAfternoon = (tasks, users) => {
  const n = Date.now();
  const tod = new Date(); tod.setHours(0, 0, 0, 0);
  const todTs = tod.getTime();
  const lines = [
    `🌆 *Reporte Vespertino — ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}*`,
    '━━━━━━━━━━━━━━━━',
  ];
  users.forEach(u => {
    const ut = tasks.filter(t => t.assignedTo === u);
    lines.push(
      `👤 *${u}*: ✅ ${ut.filter(t => t.status === 'completed' && (t.statusLog || []).some(l => l.to === 'completed' && l.timestamp >= todTs)).length} hoy  |  ` +
      `❌ ${ut.filter(t => !t.noExpiry && t.dueTimestamp >= todTs && t.dueTimestamp < n && t.status !== 'completed').length} vencidas hoy  |  ` +
      `📋 ${ut.filter(t => t.status !== 'completed').length} pendientes`
    );
  });
  return lines.join('\n');
};

// ── Handler principal ──
exports.handler = async (event) => {

  const SLACK_TODOLIST_CH = 'C0ARH1FC4V9';

  try {
    // Leer datos de Firebase
    const [tasksRaw, usersRaw, config, sentRaw] = await Promise.all([
      fbGet('v3_tasks'),
      fbGet('v3_users'),
      fbGet('v3_config'),
      fbGet(`v3_report_sent/${new Date().toISOString().split('T')[0]}`),
    ]);

    const tasks = tasksRaw ? Object.values(tasksRaw) : [];
    const users = usersRaw ? Object.values(usersRaw).map(u => u.displayName).filter(Boolean) : [];
    const sched = config?.reportSchedule;
    const sent  = sentRaw || {};
    const key   = new Date().toISOString().split('T')[0];

    if (!sched) {
      return { statusCode: 200, body: 'Sin configuración de reportes' };
    }

    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let enviado = false;

    // Reporte matutino
    if (sched.morningEnabled && sched.morningTime && !sent.morning) {
      const [h, m] = sched.morningTime.split(':').map(Number);
      const schedMin = h * 60 + m;
      // Enviamos si estamos dentro de los 5 minutos del horario configurado
      if (nowMin >= schedMin && nowMin < schedMin + 5) {
        await postSlack(SLACK_TODOLIST_CH, buildMorning(tasks, users));
        await fbSet(`v3_report_sent/${key}/morning`, true);
        console.log('[Reports] Reporte matutino enviado');
        enviado = true;
      }
    }

    // Reporte vespertino
    if (sched.afternoonEnabled && sched.afternoonTime && !sent.afternoon) {
      const [h, m] = sched.afternoonTime.split(':').map(Number);
      const schedMin = h * 60 + m;
      if (nowMin >= schedMin && nowMin < schedMin + 5) {
        await postSlack(SLACK_TODOLIST_CH, buildAfternoon(tasks, users));
        await fbSet(`v3_report_sent/${key}/afternoon`, true);
        console.log('[Reports] Reporte vespertino enviado');
        enviado = true;
      }
    }

    return {
      statusCode: 200,
      body: enviado ? 'Reporte enviado' : 'Fuera de horario o ya enviado',
    };

  } catch (err) {
    console.error('[Reports] Error:', err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
