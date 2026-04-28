import { kv } from '@vercel/kv';

function normalizarOficio(texto) {
  if (!texto) return '';
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)[0];
}

function crearSlug(nombre, oficio, zona) {
  var limpio = function(s){
    return (s||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9\s]/g,'')
      .trim().replace(/\s+/g,'-');
  };
  return limpio(nombre) + '-' + limpio(oficio) + '-' + limpio(zona);
}

function generarCodigoReferido(nombre) {
  var base = (nombre || 'pro').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z]/g,'').slice(0, 4).toUpperCase();
  var num = Math.floor(1000 + Math.random() * 9000);
  return base + num;
}

async function enviarEmailBienvenida(destinatario, nombre, codigoRef) {
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
            <div style="background:#fff;padding:30px;border:1px solid #e5e1d8;border-top:none;border-radius:0 0 12px 12px">
              <h2 style="color:#1a1410">Hola ${nombre.split(' ')[0]} 👋</h2>
              <p style="color:#555;line-height:1.6">Tu perfil profesional esta activo en MasterMatch.</p>

              <h3 style="color:#1a1410;margin-top:25px">3 cosas para hacer ahora:</h3>
              <ol style="color:#555;line-height:1.8">
                <li><strong>Sube fotos</strong> de tus trabajos (aumenta 3x los contactos)</li>
                <li><strong>Verificate</strong> con tu carnet para ganar la insignia azul</li>
                <li><strong>Invita colegas</strong> con tu codigo y gana 1 mes Pro gratis por cada uno</li>
              </ol>

              <div style="background:#fff7f0;border-left:3px solid #e88130;padding:15px;margin:20px 0;border-radius:6px">
                <strong style="color:#1a1410">Tu codigo de referido: ${codigoRef}</strong><br>
                <span style="color:#555;font-size:14px">Comparte esta URL: https://master-match.vercel.app/?ref=${codigoRef}</span>
              </div>

              <div style="background:#f5f3ef;padding:15px;border-radius:8px;margin-top:20px">
                <strong style="color:#1a1410;font-size:14px">Planes disponibles</strong><br>
                <span style="color:#555;font-size:13px">Gratis · Pro $6.990 · Premium $14.990</span>
              </div>
            </div>
          </div>
        `
      })
    });
    return { sent: res.ok };
  } catch (e) {
    return { error: e.message };
  }
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
      const { nombre, rut, whatsapp, email, oficios, zona, region, experiencia, certificaciones, otro, refCode, fechaNacimiento, categoria } = body;

      if (!nombre || !whatsapp || !zona) {
        return res.status(400).json({ error: 'Nombre, WhatsApp y zona son obligatorios' });
      }

      // VALIDACION DE EDAD 18+
      if (fechaNacimiento) {
        const nacimiento = new Date(fechaNacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
        if (edad < 18) {
          return res.status(400).json({ error: 'Debes ser mayor de 18 años para registrarte como profesional.' });
        }
        if (edad > 100) {
          return res.status(400).json({ error: 'Fecha de nacimiento inválida.' });
        }
      } else {
        return res.status(400).json({ error: 'Fecha de nacimiento es obligatoria.' });
      }

      const id = 'pro_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const oficiosArr = Array.isArray(oficios) ? oficios : [];
      const oficioPrincipal = oficiosArr[0] || 'profesional';
      const slug = crearSlug(nombre, oficioPrincipal, zona);
      const codigoRef = generarCodigoReferido(nombre);

      const profesional = {
        id, slug,
        nombre: nombre.trim(),
        rut: rut?.trim() || '',
        fechaNacimiento: fechaNacimiento,
        categoria: categoria || 'oficios',
        whatsapp: whatsapp.replace(/\D/g, ''),
        email: email?.trim() || '',
        oficios: oficiosArr,
        otroOficio: otro?.trim() || '',
        zona: zona.trim(),
        region: region || 'Metropolitana',
        experiencia: experiencia || '',
        certificaciones: certificaciones?.trim() || '',
        // Campos extendidos v8.0 (perfil más rico)
        descripcion: '',
        biografia: '',
        serviciosOfrecidos: [],
        tarifaHora: '',
        tarifaVisita: '',
        radioTrabajoKm: 15,
        horarioAtencion: '',
        idiomas: ['Español'],
        herramientasPropias: true,
        disponeVehiculo: false,
        metodosPago: [],
        comunasAtendidas: [zona.trim()],
        // Fin campos extendidos
        fotos: [],
        rating: 0,
        reviewCount: 0,
        reviews: [],
        verificado: false,
        verificacionEstado: 'sin_enviar',
        verificacionFoto: '',
        antecedentesFoto: '',
        plan: 'gratis',
        planExpira: null,
        trabajosCerrados: 0,
        gananciasMes: 0,
        disponible: true,
        codigoReferido: codigoRef,
        referidoPor: refCode || null,
        referidosExitosos: [],
        // Gamificación v8.0
        nivel: 'bronce',
        badges: ['pionero'],
        tiempoRespuestaPromedio: null,
        fechaRegistro: new Date().toISOString()
      };

      await kv.set('pro:' + id, profesional);
      await kv.set('slug:' + slug, id);
      await kv.set('ref:' + codigoRef, id);
      await kv.sadd('pros:all', id);

      for (const of of oficiosArr) {
        const key = normalizarOficio(of);
        if (key) await kv.sadd('pros:oficio:' + key, id);
      }
      if (region) await kv.sadd('pros:region:' + region.toLowerCase(), id);

      // Si vino con refCode, marcar al que lo refirio
      if (refCode) {
        const refProId = await kv.get('ref:' + refCode);
        if (refProId) {
          const refPro = await kv.get('pro:' + refProId);
          if (refPro) {
            refPro.referidosExitosos = refPro.referidosExitosos || [];
            refPro.referidosExitosos.push(id);
            // Premiar: 1 mes Pro gratis al referidor
            if (refPro.plan === 'gratis') {
              refPro.plan = 'pro';
              const expira = new Date();
              expira.setMonth(expira.getMonth() + 1);
              refPro.planExpira = expira.toISOString();
            }
            await kv.set('pro:' + refProId, refPro);
          }
        }
      }

      let emailResult = { skipped: true };
      if (email) emailResult = await enviarEmailBienvenida(email, nombre, codigoRef);

      return res.status(200).json({
        success: true, id, slug, codigoReferido: codigoRef,
        emailSent: emailResult.sent || false
      });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { 
        id, fotos, descripcion, disponible, plan, planExpira,
        biografia, serviciosOfrecidos, tarifaHora, tarifaVisita,
        radioTrabajoKm, horarioAtencion, idiomas, herramientasPropias,
        disponeVehiculo, metodosPago, comunasAtendidas,
        instagram, facebook, tiktok, linkedin, sitioWeb, youtube
      } = body;

      if (!id) return res.status(400).json({ error: 'ID requerido' });

      const pro = await kv.get('pro:' + id);
      if (!pro) return res.status(404).json({ error: 'No encontrado' });

      // Limite de fotos segun plan v8.0
      const maxFotos = pro.plan === 'premium' ? 24 : pro.plan === 'pro' ? 18 : 6;
      if (Array.isArray(fotos)) pro.fotos = fotos.slice(0, maxFotos);
      
      if (typeof descripcion === 'string') pro.descripcion = descripcion.trim().slice(0, 500);
      if (typeof biografia === 'string') pro.biografia = biografia.trim().slice(0, 1500);
      if (Array.isArray(serviciosOfrecidos)) pro.serviciosOfrecidos = serviciosOfrecidos.slice(0, 20);
      if (typeof tarifaHora === 'string') pro.tarifaHora = tarifaHora.trim().slice(0, 50);
      if (typeof tarifaVisita === 'string') pro.tarifaVisita = tarifaVisita.trim().slice(0, 50);
      if (typeof radioTrabajoKm === 'number') pro.radioTrabajoKm = Math.max(1, Math.min(100, radioTrabajoKm));
      if (typeof horarioAtencion === 'string') pro.horarioAtencion = horarioAtencion.trim().slice(0, 200);
      if (Array.isArray(idiomas)) pro.idiomas = idiomas.slice(0, 5);
      if (typeof herramientasPropias === 'boolean') pro.herramientasPropias = herramientasPropias;
      if (typeof disponeVehiculo === 'boolean') pro.disponeVehiculo = disponeVehiculo;
      if (Array.isArray(metodosPago)) pro.metodosPago = metodosPago.slice(0, 6);
      if (Array.isArray(comunasAtendidas)) pro.comunasAtendidas = comunasAtendidas.slice(0, 15);
      
      // Redes sociales v8.2
      if (typeof instagram === 'string') pro.instagram = instagram.trim().slice(0, 80);
      if (typeof facebook === 'string') pro.facebook = facebook.trim().slice(0, 150);
      if (typeof tiktok === 'string') pro.tiktok = tiktok.trim().slice(0, 80);
      if (typeof linkedin === 'string') pro.linkedin = linkedin.trim().slice(0, 150);
      if (typeof sitioWeb === 'string') pro.sitioWeb = sitioWeb.trim().slice(0, 200);
      if (typeof youtube === 'string') pro.youtube = youtube.trim().slice(0, 150);

      // Foto avatar (gratis) y portada (solo pro/premium) v8.3
      if (typeof body.fotoPerfil === 'string') pro.fotoPerfil = body.fotoPerfil.slice(0, 500);
      if (typeof body.fotoPortada === 'string') {
        // Portada es solo para Plan Pro o Premium
        if (pro.plan === 'pro' || pro.plan === 'premium') {
          pro.fotoPortada = body.fotoPortada.slice(0, 500);
        }
        // Si lo envía plan gratis, lo ignoramos silenciosamente
      }
      
      if (typeof disponible === 'boolean') pro.disponible = disponible;
      if (plan && ['gratis', 'pro', 'premium'].includes(plan)) {
        pro.plan = plan;
        if (plan !== 'gratis') {
          const expira = new Date();
          expira.setMonth(expira.getMonth() + 1);
          pro.planExpira = planExpira || expira.toISOString();
        } else {
          pro.planExpira = null;
        }
      }

      // Calculo automatico de nivel y badges v8.0
      const t = pro.trabajosCerrados || 0;
      const r = pro.rating || 0;
      const rc = pro.reviewCount || 0;
      
      if (t >= 50 && r >= 4.7) pro.nivel = 'platino';
      else if (t >= 20 && r >= 4.5) pro.nivel = 'oro';
      else if (t >= 5 && r >= 4.0) pro.nivel = 'plata';
      else pro.nivel = 'bronce';

      // Badges automáticos (recalculados cada PUT)
      const badges = new Set(pro.badges || ['pionero']);
      if (pro.verificado) badges.add('verificado');
      if ((pro.fotos || []).length >= 10) badges.add('portafolio');
      if (t >= 10) badges.add('experimentado');
      if (r >= 4.8 && rc >= 5) badges.add('excelencia');
      if (pro.plan === 'premium') badges.add('premium');
      if ((pro.referidosExitosos || []).length >= 3) badges.add('embajador');
      if (pro.biografia && pro.biografia.length > 200) badges.add('perfil_completo');
      
      pro.badges = Array.from(badges);

      await kv.set('pro:' + id, pro);
      return res.status(200).json({ success: true, pro });
    }

    if (req.method === 'GET') {
      const { oficio, zona, region, limit = 10, id, slug } = req.query;

      if (slug) {
        const proId = await kv.get('slug:' + slug);
        if (!proId) return res.status(404).json({ error: 'No encontrado' });
        const pro = await kv.get('pro:' + proId);
        if (!pro) return res.status(404).json({ error: 'No encontrado' });
        const publico = { ...pro };
        delete publico.rut;
        delete publico.email;
        delete publico.verificacionFoto;
        return res.status(200).json({ profesional: publico });
      }

      if (id) {
        const pro = await kv.get('pro:' + id);
        if (!pro) return res.status(404).json({ error: 'No encontrado' });
        const publico = { ...pro };
        delete publico.rut;
        delete publico.verificacionFoto;
        return res.status(200).json({ profesional: publico });
      }

      let ids = [];
      if (oficio) {
        const key = normalizarOficio(oficio);
        ids = await kv.smembers('pros:oficio:' + key) || [];
      } else if (region) {
        ids = await kv.smembers('pros:region:' + region.toLowerCase()) || [];
      } else {
        ids = await kv.smembers('pros:all') || [];
      }

      const profesionales = [];
      for (const pid of ids.slice(0, parseInt(limit))) {
        const pro = await kv.get('pro:' + pid);
        if (pro) {
          const publico = {
            id: pro.id, slug: pro.slug, nombre: pro.nombre, oficios: pro.oficios,
            zona: pro.zona, region: pro.region,
            experiencia: pro.experiencia, certificaciones: pro.certificaciones,
            descripcion: pro.descripcion, biografia: pro.biografia,
            serviciosOfrecidos: pro.serviciosOfrecidos || [],
            tarifaHora: pro.tarifaHora, tarifaVisita: pro.tarifaVisita,
            radioTrabajoKm: pro.radioTrabajoKm, horarioAtencion: pro.horarioAtencion,
            comunasAtendidas: pro.comunasAtendidas || [],
            disponeVehiculo: pro.disponeVehiculo, herramientasPropias: pro.herramientasPropias,
            metodosPago: pro.metodosPago || [], idiomas: pro.idiomas || ['Español'],
            instagram: pro.instagram||'', facebook: pro.facebook||'', tiktok: pro.tiktok||'',
            linkedin: pro.linkedin||'', sitioWeb: pro.sitioWeb||'', youtube: pro.youtube||'',
            fotoPerfil: pro.fotoPerfil||'', fotoPortada: pro.fotoPortada||'',
            fotos: pro.fotos || [],
            rating: pro.rating || 0, reviewCount: pro.reviewCount || 0,
            trabajosCerrados: pro.trabajosCerrados || 0,
            verificado: pro.verificado, disponible: pro.disponible,
            plan: pro.plan || 'gratis', whatsapp: pro.whatsapp,
            nivel: pro.nivel || 'bronce', badges: pro.badges || []
          };
          if (!zona || pro.zona.toLowerCase().includes(zona.toLowerCase())) {
            profesionales.push(publico);
          }
        }
      }

      profesionales.sort((a, b) => {
        const planWeight = { premium: 3, pro: 2, gratis: 1 };
        const aPlan = planWeight[a.plan] || 1;
        const bPlan = planWeight[b.plan] || 1;
        if (aPlan !== bPlan) return bPlan - aPlan;
        if (a.verificado !== b.verificado) return b.verificado ? 1 : -1;
        const aFotos = (a.fotos || []).length > 0 ? 1 : 0;
        const bFotos = (b.fotos || []).length > 0 ? 1 : 0;
        if (aFotos !== bFotos) return bFotos - aFotos;
        return (b.rating || 0) - (a.rating || 0);
      });

      return res.status(200).json({ profesionales, total: profesionales.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}

export { notificarProNuevaSolicitud };
