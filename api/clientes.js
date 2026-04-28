import { kv } from '@vercel/kv';

async function enviarEmailCliente(destinatario, nombre) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !destinatario) return { skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MasterMatch <onboarding@resend.dev>',
        to: [destinatario],
        subject: 'Bienvenido a MasterMatch, ' + nombre.split(' ')[0] + '!',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#1a1410;color:#fff;padding:30px;border-radius:12px 12px 0 0">
              <h1 style="color:#e88130;margin:0;font-size:24px">MasterMatch</h1>
              <p style="color:#aaa;margin:5px 0 0;font-size:13px">La plataforma de oficios de Chile</p>
            </div>
            <div style="padding:30px;background:#fff;border:1px solid #eee;border-radius:0 0 12px 12px">
              <h2 style="color:#2c2418">Hola ${nombre.split(' ')[0]} 👋</h2>
              <p>Tu cuenta de cliente está activa. Ahora puedes:</p>
              <ul>
                <li>✅ Solicitar presupuestos a profesionales verificados</li>
                <li>🛡️ Usar Pago Protegido con Mercado Pago</li>
                <li>⭐ Dejar reseñas de los trabajos realizados</li>
                <li>❤️ Guardar tus profesionales favoritos</li>
              </ul>
              <a href="https://master-match.vercel.app" style="background:#e88130;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;margin-top:15px">Ir a MasterMatch →</a>
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
    // POST: registro
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { nombre, whatsapp, email, fechaNacimiento, comuna, region, captchaOk } = body;

      if (!nombre || !whatsapp || !fechaNacimiento) {
        return res.status(400).json({ error: 'Nombre, WhatsApp y fecha de nacimiento son obligatorios' });
      }

      // Captcha manual (respuesta del frontend)
      if (!captchaOk) {
        return res.status(400).json({ error: 'Verificación anti-bot fallida' });
      }

      // Validación +18
      const nacimiento = new Date(fechaNacimiento);
      const hoy = new Date();
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const m = hoy.getMonth() - nacimiento.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
      if (edad < 18) return res.status(400).json({ error: 'Debes ser mayor de 18 años para registrarte.' });
      if (edad > 100) return res.status(400).json({ error: 'Fecha de nacimiento inválida.' });

      const id = 'cli_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const cliente = {
        id,
        nombre: nombre.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        email: email?.trim() || '',
        fechaNacimiento,
        comuna: comuna?.trim() || '',
        region: region || 'Metropolitana',
        fotoPerfil: '',
        biografia: '',
        favoritos: [],
        solicitudesHechas: [],
        trabajosContratados: 0,
        reseñasDadas: 0,
        verificado: true, // por haber pasado captcha + edad
        fechaRegistro: new Date().toISOString()
      };

      await kv.set('cli:' + id, cliente);
      await kv.sadd('clientes:all', id);

      let emailResult = { skipped: true };
      if (email) emailResult = await enviarEmailCliente(email, nombre);

      return res.status(200).json({ success: true, id, cliente, emailSent: emailResult.sent || false });
    }

    // PUT: actualizar perfil
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, fotoPerfil, biografia, comuna, region, favoritos } = body;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      const cli = await kv.get('cli:' + id);
      if (!cli) return res.status(404).json({ error: 'No encontrado' });

      if (typeof fotoPerfil === 'string') cli.fotoPerfil = fotoPerfil.slice(0, 500);
      if (typeof biografia === 'string') cli.biografia = biografia.trim().slice(0, 500);
      if (typeof comuna === 'string') cli.comuna = comuna.trim().slice(0, 80);
      if (typeof region === 'string') cli.region = region;
      if (Array.isArray(favoritos)) cli.favoritos = favoritos.slice(0, 50);

      await kv.set('cli:' + id, cli);
      return res.status(200).json({ success: true, cliente: cli });
    }

    // GET
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID requerido' });
      const cli = await kv.get('cli:' + id);
      if (!cli) return res.status(404).json({ error: 'No encontrado' });
      const publico = { ...cli };
      delete publico.whatsapp;
      delete publico.email;
      delete publico.fechaNacimiento;
      return res.status(200).json({ cliente: publico });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
