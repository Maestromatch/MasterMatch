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

async function marcarSolicitudPagada(solicitudId, montoFinal, pagoId) {
  const sol = await kv.get('sol:' + solicitudId);
  if (!sol) return false;
  sol.estado = 'pago_retenido';
  sol.montoFinal = montoFinal;
  sol.pagoId = pagoId;
  await kv.set('sol:' + solicitudId, sol);
  return true;
}

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
      const { tipo, monto, proId, solicitudId, planTarget, descripcion } = body;

      const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const pago = {
        id,
        tipo: tipo || 'suscripcion',
        monto: parseInt(monto) || 0,
        proId: proId || '',
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

        const titulo = tipo === 'suscripcion'
          ? 'Plan ' + (planTarget || 'Pro').toUpperCase() + ' - MasterMatch'
          : 'Pago Protegido - ' + (descripcion || 'Trabajo');

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
