import { kv } from '@vercel/kv';

function normalizarOficio(texto) {
  if (!texto) return '';
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)[0];
}

async function notificarProNuevaSolicitud(proEmail, proNombre, solicitud) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !proEmail) return { skipped: true };
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MasterMatch <onboarding@resend.dev>',
        to: [proEmail],
        subject: '🔔 Nueva solicitud: ' + solicitud.tipo + ' en ' + solicitud.zona,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#1a1410;color:#fff;padding:20px;border-radius:12px 12px 0 0">
              <h1 style="color:#e88130;margin:0;font-size:20px">Nueva solicitud para ti</h1>
            </div>
            <div style="background:#fff;padding:25px;border:1px solid #e5e1d8;border-top:none;border-radius:0 0 12px 12px">
              <p>Hola ${proNombre.split(' ')[0]},</p>
              <p>Un cliente necesita <strong>${solicitud.tipo}</strong> en <strong>${solicitud.zona}</strong>.</p>
              <div style="background:#fff7f0;padding:15px;border-radius:8px;margin:15px 0">
                <strong>Detalles:</strong><br>
                💰 ${solicitud.ppto || 'Por cotizar'}<br>
                ⏱ ${solicitud.plazo || 'Flexible'}<br>
                📍 ${solicitud.zona}<br>
                ${solicitud.pagoProtegido ? '🛡️ Cliente quiere Pago Protegido' : ''}
              </div>
              <p style="color:#555">Abre tu panel para responder.</p>
              <a href="https://master-match.vercel.app/#dash" style="background:#e88130;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700">Ver solicitud →</a>
            </div>
          </div>
        `
      })
    });
    return { sent: true };
  } catch (e) { return { error: e.message }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { tipo, ppto, plazo, zona, region, descripcion, nombreCliente, whatsappCliente, emailCliente, calidad, pagoProtegido, clienteId } = body;

      if (!tipo) return res.status(400).json({ error: 'Tipo de trabajo es obligatorio' });

      // ── v10.1: Verificar límite y estado del cliente ──────────────────────
      if (clienteId) {
        const cli = await kv.get('cli:' + clienteId);
        if (cli) {
          // 1. Verificación obligatoria para todos los clientes
          if (!cli.verificado && cli.verificacionEstado !== 'aprobado') {
            return res.status(403).json({
              error: 'verificacion_requerida',
              message: 'Debes verificar tu identidad antes de enviar solicitudes. Sube tu carnet en la sección de verificación.',
              action: 'verificar'
            });
          }

          // 2. Verificación de antecedentes para oficios delicados
          const oficiosDelicados = ['CuidadoInfantil','Cuidadora','Doctor','Enfermero','Psiquiatra','Psicologo'];
          const esDelicado = oficiosDelicados.some(o => tipo.toLowerCase().includes(o.toLowerCase()));
          if (esDelicado && !cli.antecedentesVerificados) {
            return res.status(403).json({
              error: 'antecedentes_requeridos',
              message: 'Para contratar servicios de cuidado o salud, necesitamos verificar tu certificado de antecedentes. Es por la seguridad de todos.',
              action: 'antecedentes'
            });
          }

          // 3. Límite de 2 solicitudes gratis de por vida
          const esPremium = cli.plan === 'premium';
          if (!esPremium) {
            const contadorKey = 'cli_sols_total:' + clienteId;
            const totalSols = (await kv.get(contadorKey)) || 0;
            if (totalSols >= 2) {
              return res.status(403).json({
                error: 'limite_alcanzado',
                message: 'Has usado tus 2 solicitudes gratuitas. Activa Cliente Premium para solicitudes ilimitadas.',
                action: 'upgrade',
                total: totalSols
              });
            }
            // Incrementar contador
            await kv.set(contadorKey, totalSols + 1);
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const id = 'sol_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const solicitud = {
        id,
        tipo: tipo.trim(),
        ppto: ppto?.trim() || '',
        plazo: plazo?.trim() || '',
        zona: zona?.trim() || '',
        region: region || 'Metropolitana',
        descripcion: descripcion?.trim() || '',
        nombreCliente: nombreCliente?.trim() || 'Cliente',
        whatsappCliente: whatsappCliente?.replace(/\D/g, '') || '',
        emailCliente: emailCliente?.trim() || '',
        calidad: calidad || 'B',
        pagoProtegido: !!pagoProtegido,
        estado: 'abierta', // abierta -> aceptada -> en_progreso -> completada_por_pro -> cerrada
        fechaCreacion: new Date().toISOString(),
        profesionalesNotificados: [],
        profesionalAsignado: null,
        fechaCierre: null,
        montoFinal: 0,
        pagoId: null
      };

      await kv.set('sol:' + id, solicitud);
      await kv.sadd('sols:all', id);
      await kv.sadd('sols:abiertas', id);

      const key = normalizarOficio(tipo);
      if (key) await kv.sadd('sols:oficio:' + key, id);
      if (region) await kv.sadd('sols:region:' + region.toLowerCase(), id);

      // Notificar por email a los pros del mismo oficio y region
      let profesionalesNotificar = [];
      if (key) {
        const proIds = await kv.smembers('pros:oficio:' + key) || [];
        for (const pid of proIds.slice(0, 5)) {
          const pro = await kv.get('pro:' + pid);
          if (pro && pro.disponible && (!region || pro.region === region)) {
            profesionalesNotificar.push({
              nombre: pro.nombre,
              whatsapp: pro.whatsapp,
              plan: pro.plan || 'gratis'
            });
            // Enviar email en background
            if (pro.email) {
              notificarProNuevaSolicitud(pro.email, pro.nombre, solicitud).catch(() => {});
            }
            solicitud.profesionalesNotificados.push(pid);
          }
        }
        await kv.set('sol:' + id, solicitud);
      }

      return res.status(200).json({
        success: true, id, solicitud, profesionalesNotificar
      });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, estado, profesionalAsignado, montoFinal, pagoId } = body;

      if (!id) return res.status(400).json({ error: 'ID requerido' });
      const sol = await kv.get('sol:' + id);
      if (!sol) return res.status(404).json({ error: 'No encontrada' });

      if (estado) sol.estado = estado;
      if (profesionalAsignado) sol.profesionalAsignado = profesionalAsignado;
      if (montoFinal) sol.montoFinal = parseInt(montoFinal) || 0;
      if (pagoId) sol.pagoId = pagoId;

      if (estado === 'cerrada' || estado === 'completada') {
        sol.fechaCierre = new Date().toISOString();
        await kv.srem('sols:abiertas', id);
        await kv.sadd('sols:cerradas', id);

        if (sol.profesionalAsignado) {
          const pro = await kv.get('pro:' + sol.profesionalAsignado);
          if (pro) {
            pro.trabajosCerrados = (pro.trabajosCerrados || 0) + 1;
            pro.gananciasMes = (pro.gananciasMes || 0) + (sol.montoFinal || 0);
            await kv.set('pro:' + sol.profesionalAsignado, pro);
          }
        }
      }

      await kv.set('sol:' + id, sol);
      return res.status(200).json({ success: true, solicitud: sol });
    }

    if (req.method === 'GET') {
      const { estado = 'abierta', oficio, region, id, limit = 20 } = req.query;

      if (id) {
        const sol = await kv.get('sol:' + id);
        if (!sol) return res.status(404).json({ error: 'No encontrada' });
        return res.status(200).json({ solicitud: sol });
      }

      let ids = [];
      if (oficio) {
        const key = normalizarOficio(oficio);
        ids = await kv.smembers('sols:oficio:' + key) || [];
      } else if (region) {
        ids = await kv.smembers('sols:region:' + region.toLowerCase()) || [];
      } else if (estado === 'abierta') {
        ids = await kv.smembers('sols:abiertas') || [];
      } else {
        ids = await kv.smembers('sols:all') || [];
      }

      const solicitudes = [];
      for (const sid of ids.slice(0, parseInt(limit))) {
        const sol = await kv.get('sol:' + sid);
        if (sol) solicitudes.push(sol);
      }

      solicitudes.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
      return res.status(200).json({ solicitudes, total: solicitudes.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
