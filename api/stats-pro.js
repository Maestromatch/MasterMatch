// =====================================================================
// /api/stats-pro.js — Widgets del dashboard del profesional v12.6.5
// =====================================================================
// Agrega métricas reales del pro logueado para mostrar en widgets de la
// pantalla "Inicio" (oportunidades). Calculado server-side desde KV.
//
// GET /api/stats-pro?proId=pro_xxx → JSON con widgets list-ready.

import { kv } from '@vercel/kv';

function inicioDeMes(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function inicioDeSemana(d) {
  const x = new Date(d);
  const dia = x.getDay() === 0 ? 6 : x.getDay() - 1; // lunes = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dia);
  return x.getTime();
}
function calcCompletitud(pro) {
  // Mismo cálculo que el frontend (calcularPerfilCompleto)
  const checks = [
    !!pro.fotoPerfil,
    !!pro.descripcion,
    !!pro.biografia,
    !!(pro.serviciosOfrecidos && pro.serviciosOfrecidos.length),
    !!(pro.tarifaHora || pro.tarifaVisita),
    !!pro.horarioAtencion,
    !!(pro.fotos && pro.fotos.length >= 3),
    !!pro.verificado,
    !!(pro.metodosPago && pro.metodosPago.length),
    !!(pro.instagram || pro.facebook || pro.sitioWeb)
  ];
  const ok = checks.filter(Boolean).length;
  return Math.round((ok / checks.length) * 100);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const proId = String(req.query.proId || '').trim();
  if (!proId) return res.status(400).json({ error: 'proId requerido' });

  try {
    const pro = await kv.get('pro:' + proId);
    if (!pro) return res.status(404).json({ error: 'Profesional no encontrado' });

    const ahora = Date.now();
    const inicioSem = inicioDeSemana(new Date(ahora));
    const inicioSemAnt = inicioSem - 7 * 24 * 60 * 60 * 1000;
    const inicioMes = inicioDeMes(new Date(ahora));

    // 1. Solicitudes que matchean los oficios del pro (esta y pasada semana)
    const sols = (await kv.smembers('sols:all')) || [];
    const oficios = (pro.oficios || []).map((o) => String(o).toLowerCase());
    let solsSemana = 0;
    let solsSemAnt = 0;
    let solsAceptadas = 0;
    let solsRecibidas = 0;
    const proxCitas = [];

    for (const id of sols) {
      const s = await kv.get('sol:' + id);
      if (!s) continue;
      const matchOficio = !s.oficio || oficios.length === 0 || oficios.includes(String(s.oficio || s.tipo || '').toLowerCase());
      if (!matchOficio) continue;
      const ts = new Date(s.creadoEn || s.createdAt || ahora).getTime();
      // Solicitudes asignadas o relacionadas a este pro
      if (s.proId === proId) {
        solsRecibidas++;
        if (s.estado && s.estado !== 'abierta' && s.estado !== 'cancelada') solsAceptadas++;
        // Próxima cita: si tiene fecha futura
        if (s.fechaCita && new Date(s.fechaCita).getTime() > ahora) {
          proxCitas.push({
            id: s.id,
            fecha: s.fechaCita,
            cliente: s.clienteNombre || 'Cliente',
            oficio: s.oficio || s.tipo || '',
            zona: s.zona || ''
          });
        }
      }
      // Conteo de oportunidades de la zona/oficio (no necesariamente asignadas a este pro)
      if (matchOficio && s.region === pro.region) {
        if (ts >= inicioSem) solsSemana++;
        else if (ts >= inicioSemAnt) solsSemAnt++;
      }
    }

    // 2. Ingresos del mes (suma de pagos aprobados de este pro)
    const pagosIds = (await kv.smembers('pagos:all')) || [];
    let ingresosMes = 0;
    let trabajosMes = 0;
    for (const pid of pagosIds) {
      const p = await kv.get('pay:' + pid);
      if (!p) continue;
      if (p.estado !== 'aprobado') continue;
      if (p.tipo !== 'trabajo' && p.tipo !== 'escrow_hito') continue;
      // Filtrar por proId vía solicitud asociada
      const fa = new Date(p.fechaAprobacion || p.fechaCreacion || 0).getTime();
      if (fa < inicioMes) continue;
      // Si el pago tiene proId, mejor (se setea en flujos nuevos)
      if (p.proId && p.proId !== proId) continue;
      // Si no, intentar resolver por solicitud
      if (!p.proId && p.solicitudId) {
        const ss = await kv.get('sol:' + p.solicitudId);
        if (!ss || ss.proId !== proId) continue;
      }
      ingresosMes += p.monto || 0;
      trabajosMes++;
    }

    // 3. Próxima cita (más cercana)
    proxCitas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const proxCita = proxCitas[0] || null;

    // 4. Porcentaje de respuesta (heurística): aceptadas / recibidas
    const pctRespuesta = solsRecibidas > 0 ? Math.round((solsAceptadas / solsRecibidas) * 100) : null;

    // 5. Delta semana actual vs anterior (oportunidades en zona)
    const deltaSols = solsSemana - solsSemAnt;
    const deltaPct = solsSemAnt > 0 ? Math.round(((solsSemana - solsSemAnt) / solsSemAnt) * 100) : null;

    return res.status(200).json({
      proId,
      ratingMedio: pro.rating || 0,
      reviewsCount: (pro.reviews && pro.reviews.length) || 0,
      trabajosCerrados: pro.trabajosCerrados || 0,
      perfilCompletoPct: calcCompletitud(pro),
      plan: pro.plan || 'gratis',
      verificado: !!pro.verificado,
      // Widgets temporales
      solicitudesSemana: solsSemana,
      solicitudesSemanaAnterior: solsSemAnt,
      delta: { abs: deltaSols, pct: deltaPct },
      ingresosMes,
      trabajosMes,
      pctRespuesta,
      proximaCita: proxCita,
      generadoEn: new Date().toISOString()
    });
  } catch (e) {
    console.error('[stats-pro] error:', e);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
}
