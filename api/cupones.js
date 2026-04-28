import { kv } from '@vercel/kv';

/**
 * api/cupones.js — Sistema de cupones de reactivación v10.5
 *
 * Endpoints:
 * - POST { action:'generar', adminPassword, prefix, beneficio, expira } → genera código único
 * - POST { action:'validar', codigo } → verifica si el cupón existe y no fue canjeado
 * - POST { action:'canjear', codigo, clienteId } → canjea el cupón al cliente
 * - GET  { action:'list', adminPassword } → lista todos los cupones del admin
 * - GET  { action:'inactivos', adminPassword } → clientes en cero pases que no pagaron
 *
 * Estructura del cupón:
 * {
 *   codigo: 'VUELVE-MASTER-XXXX',
 *   prefix: 'VUELVE-MASTER',
 *   beneficio: 'solicitud_extra',  // o 'mes_premium', 'descuento'
 *   valor: 1,                      // cantidad de unidades del beneficio
 *   creadoPor: 'admin',
 *   fechaCreacion: '2026-04-25...',
 *   fechaExpira: '2026-05-25...',  // null = nunca expira
 *   canjeado: false,
 *   canjeadoPor: null,             // clienteId
 *   fechaCanje: null,
 *   destinatario: null             // si fue dirigido a un cliente específico
 * }
 */

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'maestromatch2026';

function generarCodigo(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/I/1 confusos
  let r = '';
  for (let i = 0; i < 5; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return (prefix || 'VUELVE-MASTER') + '-' + r;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ─── GET: listas para admin ───
    if (req.method === 'GET') {
      const action = req.query.action;
      const password = req.query.password;

      if (action === 'list') {
        if (password !== ADMIN_PASS) return res.status(401).json({ error: 'No autorizado' });
        const ids = (await kv.smembers('cupones:all')) || [];
        const cupones = [];
        for (const id of ids.slice(-100).reverse()) {
          const c = await kv.get('cupon:' + id);
          if (c) cupones.push(c);
        }
        return res.status(200).json({ success: true, cupones });
      }

      if (action === 'inactivos') {
        if (password !== ADMIN_PASS) return res.status(401).json({ error: 'No autorizado' });
        // Clientes con 2+ solicitudes (límite agotado) que NO son Premium
        const allClis = (await kv.smembers('clientes:all')) || [];
        const inactivos = [];
        for (const cid of allClis) {
          const cli = await kv.get('cli:' + cid);
          if (!cli) continue;
          const totalSols = (await kv.get('cli_sols_total:' + cid)) || 0;
          const esPremium = cli.plan === 'premium';
          if (totalSols >= 2 && !esPremium) {
            inactivos.push({
              id: cli.id,
              nombre: cli.nombre,
              email: cli.email || '',
              whatsapp: cli.whatsapp || '',
              totalSolicitudes: totalSols,
              ultimaActividad: cli.ultimaActividad || cli.fechaCreacion,
              region: cli.region || '',
              fechaCreacion: cli.fechaCreacion
            });
          }
        }
        // Ordenar por última actividad más reciente primero
        inactivos.sort((a, b) => new Date(b.ultimaActividad || 0) - new Date(a.ultimaActividad || 0));
        return res.status(200).json({ success: true, clientes: inactivos.slice(0, 200) });
      }

      return res.status(400).json({ error: 'Acción inválida' });
    }

    // ─── POST: acciones ───
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const action = body.action;

    // Generar cupón nuevo (admin)
    if (action === 'generar') {
      if (body.adminPassword !== ADMIN_PASS) return res.status(401).json({ error: 'No autorizado' });

      const prefix = (body.prefix || 'VUELVE-MASTER').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const beneficio = body.beneficio || 'solicitud_extra';
      const valor = parseInt(body.valor) || 1;
      const expiraEnDias = parseInt(body.expiraEnDias) || 30;
      const destinatarioId = body.destinatario || null;

      // Generar código único (reintenta si colisiona)
      let codigo;
      for (let i = 0; i < 5; i++) {
        codigo = generarCodigo(prefix);
        const existing = await kv.get('cupon:' + codigo);
        if (!existing) break;
        if (i === 4) return res.status(500).json({ error: 'No se pudo generar código único' });
      }

      const fechaExpira = expiraEnDias > 0
        ? new Date(Date.now() + expiraEnDias * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const cupon = {
        codigo,
        prefix,
        beneficio,
        valor,
        creadoPor: 'admin',
        fechaCreacion: new Date().toISOString(),
        fechaExpira,
        canjeado: false,
        canjeadoPor: null,
        fechaCanje: null,
        destinatario: destinatarioId
      };

      await kv.set('cupon:' + codigo, cupon);
      await kv.sadd('cupones:all', codigo);
      if (destinatarioId) await kv.sadd('cupones:cliente:' + destinatarioId, codigo);

      return res.status(200).json({ success: true, cupon });
    }

    // Validar cupón (frontend del cliente)
    if (action === 'validar') {
      const codigo = (body.codigo || '').toUpperCase().trim();
      if (!codigo) return res.status(400).json({ error: 'Código requerido' });

      const cupon = await kv.get('cupon:' + codigo);
      if (!cupon) return res.status(404).json({ valid: false, error: 'Cupón no existe' });
      if (cupon.canjeado) return res.status(200).json({ valid: false, error: 'Cupón ya canjeado' });
      if (cupon.fechaExpira && new Date(cupon.fechaExpira) < new Date()) {
        return res.status(200).json({ valid: false, error: 'Cupón expirado' });
      }
      // Si es dirigido a un cliente específico, validar
      if (cupon.destinatario && body.clienteId && cupon.destinatario !== body.clienteId) {
        return res.status(200).json({ valid: false, error: 'Este cupón no es para ti' });
      }
      return res.status(200).json({
        valid: true,
        codigo: cupon.codigo,
        beneficio: cupon.beneficio,
        valor: cupon.valor,
        descripcion: descripcionBeneficio(cupon.beneficio, cupon.valor)
      });
    }

    // Canjear cupón (cliente)
    if (action === 'canjear') {
      const codigo = (body.codigo || '').toUpperCase().trim();
      const clienteId = body.clienteId;
      if (!codigo || !clienteId) return res.status(400).json({ error: 'Código y clienteId obligatorios' });

      const cupon = await kv.get('cupon:' + codigo);
      if (!cupon) return res.status(404).json({ error: 'Cupón no existe' });
      if (cupon.canjeado) return res.status(400).json({ error: 'Cupón ya canjeado' });
      if (cupon.fechaExpira && new Date(cupon.fechaExpira) < new Date()) {
        return res.status(400).json({ error: 'Cupón expirado' });
      }
      if (cupon.destinatario && cupon.destinatario !== clienteId) {
        return res.status(400).json({ error: 'Este cupón no es para ti' });
      }

      // Aplicar beneficio según tipo
      if (cupon.beneficio === 'solicitud_extra') {
        // Restar del contador de solicitudes (le da N solicitudes extra)
        const key = 'cli_sols_total:' + clienteId;
        const total = (await kv.get(key)) || 0;
        const nuevoTotal = Math.max(0, total - cupon.valor);
        await kv.set(key, nuevoTotal);
      } else if (cupon.beneficio === 'mes_premium') {
        // Buscar primero como profesional, luego como cliente
        const proData = await kv.get('pro:' + clienteId);
        if (proData) {
          proData.plan = 'premium';
          const expira = new Date();
          expira.setMonth(expira.getMonth() + cupon.valor);
          proData.planExpira = expira.toISOString();
          proData.cuponPlan = codigo;
          await kv.set('pro:' + clienteId, proData);
        } else {
          const cli = await kv.get('cli:' + clienteId);
          if (cli) {
            cli.plan = 'premium';
            const expira = new Date();
            expira.setMonth(expira.getMonth() + cupon.valor);
            cli.planExpira = expira.toISOString();
            cli.cuponPlan = codigo;
            await kv.set('cli:' + clienteId, cli);
          }
        }
      }

      // Marcar el cupón como canjeado
      cupon.canjeado = true;
      cupon.canjeadoPor = clienteId;
      cupon.fechaCanje = new Date().toISOString();
      await kv.set('cupon:' + codigo, cupon);
      await kv.sadd('cupones:canjeados', codigo);

      return res.status(200).json({
        success: true,
        beneficio: cupon.beneficio,
        valor: cupon.valor,
        mensaje: '¡Cupón canjeado! ' + descripcionBeneficio(cupon.beneficio, cupon.valor)
      });
    }

    // Eliminar cupón (admin)
    if (action === 'eliminar') {
      if (body.adminPassword !== ADMIN_PASS) return res.status(401).json({ error: 'No autorizado' });
      const codigo = (body.codigo || '').toUpperCase().trim();
      if (!codigo) return res.status(400).json({ error: 'Código requerido' });
      await kv.del('cupon:' + codigo);
      await kv.srem('cupones:all', codigo);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Acción inválida' });

  } catch (e) {
    console.error('[cupones]', e);
    return res.status(500).json({ error: e.message });
  }
}

function descripcionBeneficio(tipo, valor) {
  if (tipo === 'solicitud_extra') return 'Recibiste ' + valor + ' solicitud' + (valor > 1 ? 'es' : '') + ' gratis adicional' + (valor > 1 ? 'es' : '');
  if (tipo === 'mes_premium') return 'Tienes ' + valor + ' mes' + (valor > 1 ? 'es' : '') + ' de Plan Premium gratis';
  if (tipo === 'descuento') return 'Tienes ' + valor + '% de descuento en tu próximo pago';
  return 'Beneficio activado';
}
