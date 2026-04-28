import { kv } from '@vercel/kv';

/**
 * API /api/auth — endpoint de autenticación social
 *
 * POST con: { email, nombre, foto, uid, provider }
 *
 * Respuesta:
 * - { success:true, exists:true, role:'pro'|'cliente', profile:{...} } — si ya existe
 * - { success:true, exists:false, prefill:{..., role} } — si es nuevo (frontend pre-llena el form)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, nombre, foto, uid, provider, role } = body;

    if (!email || !uid) {
      return res.status(400).json({ error: 'Email y uid son obligatorios' });
    }

    const emailKey = email.toLowerCase().trim();
    const requestedRole = role === 'pro' || role === 'cliente' ? role : 'cliente';

    // Buscar perfiles existentes asociados a este email/uid
    // 1. Primero buscar en mapa social_uid → user_id
    const socialMap = await kv.get('social:' + uid);

    if (socialMap) {
      // Usuario ya autenticado antes con este UID
      if (socialMap.role === 'pro') {
        const pro = await kv.get('pro:' + socialMap.id);
        if (pro) {
          return res.status(200).json({
            success: true,
            exists: true,
            role: 'pro',
            profile: pro
          });
        }
      } else if (socialMap.role === 'cliente') {
        const cli = await kv.get('cli:' + socialMap.id);
        if (cli) {
          return res.status(200).json({
            success: true,
            exists: true,
            role: 'cliente',
            profile: cli
          });
        }
      }
    }

    // 2. Buscar por email entre todos los pros
    let foundPro = null;
    let foundCli = null;
    try {
      const allPros = await kv.smembers('pros:all') || [];
      for (const pid of allPros) {
        const p = await kv.get('pro:' + pid);
        if (p && p.email && p.email.toLowerCase().trim() === emailKey) {
          foundPro = p;
          break;
        }
      }
    } catch (e) { /* sigue */ }

    try {
      const allClis = await kv.smembers('clientes:all') || [];
      for (const cid of allClis) {
        const c = await kv.get('cli:' + cid);
        if (c && c.email && c.email.toLowerCase().trim() === emailKey) {
          foundCli = c;
          break;
        }
      }
    } catch (e) { /* sigue */ }

    // 3. Si encontramos un pro por email — vincular UID y devolver
    if (foundPro) {
      foundPro.socialUid = uid;
      foundPro.socialProvider = provider || 'google';
      if (foto && !foundPro.fotoPerfil) foundPro.fotoPerfil = foto;
      await kv.set('pro:' + foundPro.id, foundPro);
      await kv.set('social:' + uid, { role: 'pro', id: foundPro.id });
      return res.status(200).json({
        success: true,
        exists: true,
        role: 'pro',
        profile: foundPro
      });
    }

    if (foundCli) {
      foundCli.socialUid = uid;
      foundCli.socialProvider = provider || 'google';
      if (foto && !foundCli.fotoPerfil) foundCli.fotoPerfil = foto;
      await kv.set('cli:' + foundCli.id, foundCli);
      await kv.set('social:' + uid, { role: 'cliente', id: foundCli.id });
      return res.status(200).json({
        success: true,
        exists: true,
        role: 'cliente',
        profile: foundCli
      });
    }

    // 4. Usuario completamente nuevo — devolver prefill con rol pre-asignado v9.2
    return res.status(200).json({
      success: true,
      exists: false,
      prefill: {
        email: emailKey,
        nombre: nombre || 'Usuario',
        foto: foto || '',
        uid: uid,
        provider: provider || 'google',
        role: requestedRole
      }
    });

  } catch (e) {
    console.error('[auth] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
