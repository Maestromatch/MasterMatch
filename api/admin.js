import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const adminPass = process.env.ADMIN_PASSWORD || 'maestromatch2026';
    if (body.password !== adminPass) return res.status(401).json({ error: 'No autorizado' });

    const proIds = await kv.smembers('pros:all') || [];
    const profesionales = [];
    for (const id of proIds) {
      const pro = await kv.get('pro:' + id);
      if (pro) profesionales.push(pro);
    }
    profesionales.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));

    const solIds = await kv.smembers('sols:all') || [];
    const solicitudes = [];
    for (const id of solIds) {
      const sol = await kv.get('sol:' + id);
      if (sol) solicitudes.push(sol);
    }
    solicitudes.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    const leadIds = await kv.smembers('leads:all') || [];
    const leads = [];
    for (const id of leadIds) {
      const lead = await kv.get('lead:' + id);
      if (lead) leads.push(lead);
    }
    leads.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    // Pagos
    const pagoIds = await kv.smembers('pagos:all') || [];
    const pagos = [];
    for (const id of pagoIds) {
      const p = await kv.get('pay:' + id);
      if (p) pagos.push(p);
    }
    pagos.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    // Verificaciones pendientes
    const verifIds = await kv.smembers('verif:pendientes') || [];
    const verificacionesPendientes = [];
    for (const id of verifIds) {
      const pro = await kv.get('pro:' + id);
      if (pro) {
        verificacionesPendientes.push({
          id: pro.id,
          nombre: pro.nombre,
          rut: pro.rut,
          oficios: pro.oficios,
          zona: pro.zona,
          verificacionFoto: pro.verificacionFoto,
          verificacionFecha: pro.verificacionFecha
        });
      }
    }

    // Stats
    const oficiosCount = {};
    const zonasCount = {};
    const regionesCount = {};
    const planesCount = { gratis: 0, pro: 0, premium: 0 };
    let ingresosMensuales = 0;
    let comisionesPotenciales = 0;
    let totalVerificados = 0;

    profesionales.forEach(p => {
      (p.oficios || []).forEach(o => { oficiosCount[o] = (oficiosCount[o] || 0) + 1; });
      if (p.zona) zonasCount[p.zona] = (zonasCount[p.zona] || 0) + 1;
      if (p.region) regionesCount[p.region] = (regionesCount[p.region] || 0) + 1;
      const plan = p.plan || 'gratis';
      planesCount[plan] = (planesCount[plan] || 0) + 1;
      if (plan === 'pro') ingresosMensuales += 6990;
      if (plan === 'premium') ingresosMensuales += 14990;
      if (p.verificado) totalVerificados++;
    });

    const solicitudesPorOficio = {};
    let solicitudesCerradas = 0;
    let montoTotalCerrado = 0;
    solicitudes.forEach(s => {
      if (s.tipo) solicitudesPorOficio[s.tipo] = (solicitudesPorOficio[s.tipo] || 0) + 1;
      if (s.estado === 'cerrada' || s.estado === 'completada') {
        solicitudesCerradas++;
        montoTotalCerrado += s.montoFinal || 0;
        if (s.pagoProtegido) comisionesPotenciales += Math.round((s.montoFinal || 0) * 0.08);
      }
    });

    // Ingresos reales de pagos aprobados
    let ingresosRealesPagos = 0;
    pagos.forEach(p => {
      if (p.estado === 'aprobado') ingresosRealesPagos += p.monto || 0;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalPros: profesionales.length,
        totalSols: solicitudes.length,
        totalLeads: leads.length,
        totalVerificados,
        totalPagos: pagos.length,
        ingresosRealesPagos,
        solicitudesCerradas,
        montoTotalCerrado,
        ingresosMensuales,
        comisionesPotenciales,
        ingresosTotales: ingresosMensuales + comisionesPotenciales,
        oficiosCount,
        zonasCount,
        regionesCount,
        planesCount,
        solicitudesPorOficio,
        pendientesVerif: verificacionesPendientes.length
      },
      profesionales,
      solicitudes,
      leads,
      pagos,
      verificacionesPendientes
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
