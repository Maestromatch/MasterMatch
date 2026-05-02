import { kv } from '@vercel/kv';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

function getClient() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

async function activarPlanPro(proId, planTarget) {
  const pro = await kv.get('pro:' + proId);
  if (!pro) return false;
  pro.plan = planTarget;
  const expira = new Date();
  expira.setMonth(expira.getMonth() + 1);
  pro.planExpira = expira.toISOString();
  await kv.set('pro:' + proId, pro);
  return true;
}

// Activar plan cliente — soporta pase24h (24h), plus/premium/empresa (mensual) v12.5
async function activarPlanCli(clienteId, planTarget) {
  const cli = await kv.get('cli:' + clienteId);
  if (!cli) return false;
  cli.plan = planTarget;
  cli.planActivadoEn = new Date().toISOString();
  if (planTarget === 'pase24h') {
    const exp = new Date();
    exp.setHours(exp.getHours() + 24);
    cli.planExpiraEn = exp.toISOString();
    cli.chatsUsadosPase = 0;
  } else if (planTarget === 'plus' || planTarget === 'premium' || planTarget === 'empresa') {
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 1);
    cli.planExpiraEn = exp.toISOString();
    cli.chatsUsadosMes = 0;
    cli.expresUsadosMes = 0;
  }
  await kv.set('cli:' + clienteId, cli);
  return true;
}

async function registrarExpres(clienteId, solicitudId) {
  const cli = await kv.get('cli:' + clienteId);
  if (cli) {
    cli.expresUsadosMes = (cli.expresUsadosMes || 0) + 1;
    await kv.set('cli:' + clienteId, cli);
  }
  const sol = await kv.get('sol:' + solicitudId);
  if (sol) {
    sol.expres = true;
    sol.urgente = true;
    await kv.set('sol:' + solicitudId, sol);
  }
}

async function marcarSolicitudPagada(solicitudId, montoFinal, pagoId) {
  const sol = await kv.get('sol:' + solicitudId);
  if (!sol) return false;
  sol.estado = 'pago_retenido';
  sol.montoFinal = montoFinal;
  sol.pagoId = pagoId;
  await kv.set('sol:' + solicitudId, sol);
  return true;
}

// === Escrow por hitos v12.6 ===
// Para trabajos sobre $300k. El cliente define N hitos (mínimo 2, máximo 5)
// con un % del total cada uno. El primero se cobra al firmar contrato; los
// siguientes se liberan al confirmar entrega del entregable.
async function crearEscrowHitos(solicitudId, hitos, totalCLP) {
  const sol = await kv.get('sol:' + solicitudId);
  if (!sol) return { ok: false, error: 'Solicitud no encontrada' };
  if (totalCLP < 300000) return { ok: false, error: 'Pago por hitos disponible solo para trabajos sobre $300.000' };
  if (!Array.isArray(hitos) || hitos.length < 2 || hitos.length > 5) {
    return { ok: false, error: 'Debes definir entre 2 y 5 hitos' };
  }
  const sumPct = hitos.reduce((s, h) => s + (Number(h.pct) || 0), 0);
  if (Math.abs(sumPct - 100) > 0.5) return { ok: false, error: 'Los porcentajes deben sumar 100%' };

  const escrow = {
    id: 'esc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    solicitudId,
    totalCLP: parseInt(totalCLP),
    estado: 'pendiente_pago_inicial',
    creadoEn: new Date().toISOString(),
    hitos: hitos.map((h, i) => ({
      n: i + 1,
      titulo: String(h.titulo || `Hito ${i + 1}`).slice(0, 100),
      descripcion: String(h.descripcion || '').slice(0, 300),
      pct: Number(h.pct),
      monto: Math.round(parseInt(totalCLP) * (Number(h.pct) / 100)),
      estado: i === 0 ? 'por_pagar' : 'pendiente',
      pagoId: null,
      pagadoEn: null,
      liberadoEn: null
    }))
  };
  await kv.set('esc:' + escrow.id, escrow);
  sol.escrowId = escrow.id;
  sol.modalidadPago = 'hitos';
  await kv.set('sol:' + solicitudId, sol);
  return { ok: true, escrow };
}

async function pagarHitoEscrow(escrowId, hitoN, pagoId) {
  const esc = await kv.get('esc:' + escrowId);
  if (!esc) return { ok: false, error: 'Escrow no encontrado' };
  const hito = esc.hitos.find((h) => h.n === Number(hitoN));
  if (!hito) return { ok: false, error: 'Hito inexistente' };
  hito.estado = 'pagado_retenido';
  hito.pagoId = pagoId;
  hito.pagadoEn = new Date().toISOString();
  // Si era el primero: marca el escrow como activo
  if (hitoN === 1 && esc.estado === 'pendiente_pago_inicial') esc.estado = 'activo';
  await kv.set('esc:' + escrowId, esc);
  return { ok: true, hito };
}

async function liberarHitoEscrow(escrowId, hitoN, accion) {
  // accion = 'confirmar' (cliente acepta entregable y libera el siguiente)
  //       o 'disputar' (cliente reporta problema; congela el flujo)
  const esc = await kv.get('esc:' + escrowId);
  if (!esc) return { ok: false, error: 'Escrow no encontrado' };
  const hito = esc.hitos.find((h) => h.n === Number(hitoN));
  if (!hito) return { ok: false, error: 'Hito inexistente' };
  if (hito.estado !== 'pagado_retenido') return { ok: false, error: 'Hito no está en estado liberable' };

  if (accion === 'disputar') {
    hito.estado = 'en_disputa';
    esc.estado = 'en_disputa';
    await kv.set('esc:' + escrowId, esc);
    return { ok: true, accion: 'disputado' };
  }

  hito.estado = 'liberado_pro';
  hito.liberadoEn = new Date().toISOString();
  // Activar el siguiente hito como 'por_pagar'
  const siguiente = esc.hitos.find((h) => h.n === hito.n + 1);
  if (siguiente && siguiente.estado === 'pendiente') siguiente.estado = 'por_pagar';
  // Si era el último, marcar escrow como completo
  const todosLiberados = esc.hitos.every((h) => h.estado === 'liberado_pro');
  if (todosLiberados) esc.estado = 'completado';
  await kv.set('esc:' + escrowId, esc);
  return { ok: true, accion: 'liberado', siguienteHito: siguiente || null, completado: todosLiberados };
}

// SKUs cliente v12.5 — fuente única de verdad de precios cliente
const SKU_CLIENTE = {
  pase24h: { precio: 490,   tipo: 'cliente_pase' },
  plus:    { precio: 4990,  tipo: 'cliente_sub' },
  premium: { precio: 9990,  tipo: 'cliente_sub' },
  empresa: { precio: 24990, tipo: 'cliente_sub' },
  expres:  { precio: 1490,  tipo: 'cliente_addon' }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // WEBHOOK de Mercado Pago
    if (req.method === 'POST' && req.query.webhook === 'true') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('MP Webhook:', JSON.stringify(body));

      const client = getClient();
      if (!client) return res.status(200).json({ received: true });

      const topic = body.type || body.topic;
      const paymentId = body.data?.id || body.id;

      if (topic === 'payment' && paymentId) {
        try {
          const payment = new Payment(client);
          const info = await payment.get({ id: paymentId });
          const externalRef = info.external_reference; // nuestro pay_id
          const status = info.status; // approved, pending, rejected

          if (externalRef) {
            const pago = await kv.get('pay:' + externalRef);
            if (pago) {
              pago.estado = status === 'approved' ? 'aprobado' : status;
              pago.mercadoPagoId = paymentId;
              pago.fechaAprobacion = status === 'approved' ? new Date().toISOString() : null;
              await kv.set('pay:' + externalRef, pago);

              if (status === 'approved') {
                if (pago.tipo === 'suscripcion' && pago.proId && pago.planTarget) {
                  await activarPlanPro(pago.proId, pago.planTarget);
                } else if ((pago.tipo === 'cliente_sub' || pago.tipo === 'cliente_pase') && pago.clienteId && pago.planTarget) {
                  await activarPlanCli(pago.clienteId, pago.planTarget);
                } else if (pago.tipo === 'cliente_addon' && pago.clienteId && pago.solicitudId) {
                  await registrarExpres(pago.clienteId, pago.solicitudId);
                } else if (pago.tipo === 'escrow_hito' && pago.escrowId && pago.hitoN) {
                  await pagarHitoEscrow(pago.escrowId, pago.hitoN, paymentId);
                } else if (pago.tipo === 'trabajo' && pago.solicitudId) {
                  await marcarSolicitudPagada(pago.solicitudId, pago.monto, paymentId);
                }
              }
            }
          }
        } catch (e) {
          console.log('Error webhook:', e.message);
        }
      }

      return res.status(200).json({ received: true });
    }

    // POST: crear pago (redirige a Checkout Pro)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      let { tipo, monto, proId, clienteId, solicitudId, planTarget, descripcion, plan } = body;

      // v12.5 — soporte planes cliente: si llega 'plan' y 'tipo:cliente', mapeo desde SKU_CLIENTE
      if (body.tipo === 'cliente' && plan && SKU_CLIENTE[plan]) {
        const sku = SKU_CLIENTE[plan];
        tipo = sku.tipo;
        monto = sku.precio;
        planTarget = plan;
      }

      const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const pago = {
        id,
        tipo: tipo || 'suscripcion',
        monto: parseInt(monto) || 0,
        proId: proId || '',
        clienteId: clienteId || '',
        solicitudId: solicitudId || '',
        planTarget: planTarget || '',
        estado: 'pendiente',
        descripcion: descripcion || '',
        fechaCreacion: new Date().toISOString(),
        fechaAprobacion: null,
        mercadoPagoId: null
      };

      await kv.set('pay:' + id, pago);
      await kv.sadd('pagos:all', id);

      const client = getClient();
      if (!client) {
        // Modo demo sin token
        return res.status(200).json({
          success: true,
          id,
          pago,
          demo: true,
          mensaje: 'MERCADOPAGO_ACCESS_TOKEN no configurado. En demo mode.'
        });
      }

      try {
        const preference = new Preference(client);
        const siteUrl = process.env.SITE_URL || 'https://master-match.vercel.app';

        let titulo;
        if (tipo === 'suscripcion') titulo = 'Plan ' + (planTarget || 'Pro').toUpperCase() + ' - MasterMatch (Profesional)';
        else if (tipo === 'cliente_sub') titulo = 'Plan Cliente ' + (planTarget || 'Plus').toUpperCase() + ' - MasterMatch';
        else if (tipo === 'cliente_pase') titulo = 'Pase 24h Cliente - MasterMatch';
        else if (tipo === 'cliente_addon') titulo = 'Cotización Exprés - MasterMatch';
        else titulo = 'Pago Protegido - ' + (descripcion || 'Trabajo');

        const pref = await preference.create({
          body: {
            items: [{
              id: id,
              title: titulo,
              quantity: 1,
              unit_price: pago.monto,
              currency_id: 'CLP'
            }],
            back_urls: {
              success: siteUrl + '/#pago-ok-' + id,
              failure: siteUrl + '/#pago-fail-' + id,
              pending: siteUrl + '/#pago-pending-' + id
            },
            auto_return: 'approved',
            notification_url: siteUrl + '/api/pagos?webhook=true',
            external_reference: id,
            statement_descriptor: 'MAESTROMATCH'
          }
        });

        pago.preferenceId = pref.id;
        pago.initPoint = pref.init_point;
        pago.sandboxInitPoint = pref.sandbox_init_point;
        await kv.set('pay:' + id, pago);

        return res.status(200).json({
          success: true,
          id,
          pago,
          preferenceId: pref.id,
          initPoint: pref.init_point,
          init_point: pref.init_point,
          sandboxInitPoint: pref.sandbox_init_point
        });
      } catch (mpError) {
        console.log('Error MP:', mpError.message);
        return res.status(500).json({
          error: 'Error Mercado Pago: ' + mpError.message,
          id,
          pago
        });
      }
    }

    // GET: verificar estado
    if (req.method === 'GET') {
      // GET ?escrowId= → devuelve estado completo del escrow por hitos
      if (req.query.escrowId) {
        const esc = await kv.get('esc:' + req.query.escrowId);
        if (!esc) return res.status(404).json({ error: 'Escrow no encontrado' });
        return res.status(200).json({ escrow: esc });
      }
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID requerido' });
      const pago = await kv.get('pay:' + id);
      if (!pago) return res.status(404).json({ error: 'No encontrado' });
      return res.status(200).json({ pago });
    }

    // PATCH (action en query): operaciones sobre escrow por hitos
    // ?action=crear-escrow {solicitudId, hitos[], totalCLP}
    // ?action=pagar-hito {escrowId, hitoN}  (genera preference MP del hito)
    // ?action=liberar-hito {escrowId, hitoN, accion: 'confirmar'|'disputar'}
    if (req.method === 'PATCH' || (req.method === 'POST' && req.query.action)) {
      const action = req.query.action;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (action === 'crear-escrow') {
        const r = await crearEscrowHitos(body.solicitudId, body.hitos, body.totalCLP);
        return res.status(r.ok ? 200 : 400).json(r);
      }

      if (action === 'pagar-hito') {
        const esc = await kv.get('esc:' + body.escrowId);
        if (!esc) return res.status(404).json({ error: 'Escrow no encontrado' });
        const hito = esc.hitos.find((h) => h.n === Number(body.hitoN));
        if (!hito) return res.status(404).json({ error: 'Hito no encontrado' });
        if (hito.estado !== 'por_pagar') return res.status(400).json({ error: `Hito #${hito.n} no está en estado por_pagar` });

        const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const pago = {
          id, tipo: 'escrow_hito', monto: hito.monto,
          escrowId: esc.id, hitoN: hito.n, solicitudId: esc.solicitudId,
          estado: 'pendiente', fechaCreacion: new Date().toISOString()
        };
        await kv.set('pay:' + id, pago);

        const client = getClient();
        if (!client) return res.status(200).json({ success: true, demo: true, pago });

        try {
          const preference = new Preference(client);
          const siteUrl = process.env.SITE_URL || 'https://master-match.vercel.app';
          const pref = await preference.create({
            body: {
              items: [{
                id, title: `Hito ${hito.n}/${esc.hitos.length} — ${hito.titulo}`,
                quantity: 1, unit_price: hito.monto, currency_id: 'CLP'
              }],
              back_urls: {
                success: siteUrl + '/#hito-ok-' + id,
                failure: siteUrl + '/#hito-fail-' + id,
                pending: siteUrl + '/#hito-pending-' + id
              },
              auto_return: 'approved',
              notification_url: siteUrl + '/api/pagos?webhook=true',
              external_reference: id,
              statement_descriptor: 'MAESTROMATCH'
            }
          });
          pago.preferenceId = pref.id;
          pago.initPoint = pref.init_point;
          await kv.set('pay:' + id, pago);
          return res.status(200).json({ success: true, id, init_point: pref.init_point, hito });
        } catch (mpError) {
          console.log('Error MP:', mpError.message);
          return res.status(500).json({ error: 'Error Mercado Pago: ' + mpError.message });
        }
      }

      if (action === 'liberar-hito') {
        const r = await liberarHitoEscrow(body.escrowId, body.hitoN, body.accion);
        return res.status(r.ok ? 200 : 400).json(r);
      }

      return res.status(400).json({ error: 'action no reconocida' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.log('Error pagos:', error.message);
    return res.status(500).json({ error: error.message || 'Error' });
  }
}
