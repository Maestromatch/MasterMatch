import { kv } from '@vercel/kv';

async function enviarEmailVerificacion(destinatario, nombre, aprobado) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !destinatario) return { skipped: true };
  try {
    const titulo = aprobado ? '✓ Verificación aprobada' : 'Verificación rechazada';
    const body = aprobado
      ? `Tu identidad fue verificada. Ahora tienes la insignia azul "Verificado" en tu perfil. Los clientes te tendrán más confianza.`
      : `No pudimos verificar tu identidad con la foto que enviaste. Sube una foto más clara de tu carnet de identidad.`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MasterMatch <onboarding@resend.dev>',
        to: [destinatario],
        subject: titulo,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#1a1410;color:#fff;padding:25px;border-radius:12px 12px 0 0">
              <h1 style="color:#e88130;margin:0;font-size:20px">${titulo}</h1>
            </div>
            <div style="background:#fff;padding:25px;border:1px solid #e5e1d8;border-top:none;border-radius:0 0 12px 12px">
              <p>Hola ${nombre.split(' ')[0]},</p>
              <p>${body}</p>
              <a href="https://master-match.vercel.app/#dash" style="background:#e88130;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;margin-top:15px">Abrir panel →</a>
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // POST: el pro sube su foto de carnet
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { proId, fotoUrl, action, adminPassword, aprobado } = body;

      // Accion de admin: aprobar/rechazar
      if (action === 'review') {
        const expectedPass = process.env.ADMIN_PASSWORD || 'maestromatch2026';
        if (adminPassword !== expectedPass) return res.status(401).json({ error: 'No autorizado' });

        const pro = await kv.get('pro:' + proId);
        if (!pro) return res.status(404).json({ error: 'No encontrado' });

        if (aprobado) {
          pro.verificado = true;
          pro.verificacionEstado = 'aprobado';
        } else {
          pro.verificado = false;
          pro.verificacionEstado = 'rechazado';
        }
        await kv.set('pro:' + proId, pro);
        await kv.srem('verif:pendientes', proId);

        if (pro.email) {
          await enviarEmailVerificacion(pro.email, pro.nombre, aprobado);
        }
        return res.status(200).json({ success: true, verificado: pro.verificado });
      }

      // Pro sube su foto de carnet
      if (!proId || !fotoUrl) return res.status(400).json({ error: 'proId y fotoUrl requeridos' });

      const pro = await kv.get('pro:' + proId);
      if (!pro) return res.status(404).json({ error: 'No encontrado' });

      pro.verificacionFoto = fotoUrl;
      pro.verificacionEstado = 'pendiente';
      pro.verificacionFecha = new Date().toISOString();
      await kv.set('pro:' + proId, pro);
      await kv.sadd('verif:pendientes', proId);

      return res.status(200).json({
        success: true,
        mensaje: 'Foto recibida. En 24-48 horas revisaremos tu verificación.'
      });
    }

    // GET: listar pendientes de verificación (admin)
    if (req.method === 'GET') {
      const { adminPassword } = req.query;
      const expectedPass = process.env.ADMIN_PASSWORD || 'maestromatch2026';
      if (adminPassword !== expectedPass) return res.status(401).json({ error: 'No autorizado' });

      const pendientesIds = await kv.smembers('verif:pendientes') || [];
      const pendientes = [];
      for (const pid of pendientesIds) {
        const pro = await kv.get('pro:' + pid);
        if (pro) {
          pendientes.push({
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
      return res.status(200).json({ pendientes });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error' });
  }
}
