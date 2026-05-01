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
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      const pago = await kv.get('pay:' + id);
      if (!pago) return res.status(404).json({ error: 'No encontrado' });

      return res.status(200).json({ pago });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.log('Error pagos:', error.message);
    return res.status(500).json({ error: error.message || 'Error' });
  }
}
