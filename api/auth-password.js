import { kv } from '@vercel/kv';
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);

/**
 * /api/auth-password — autenticacion con email + contrasena.
 *
 * POST { action:'signup', email, password, role:'pro'|'cliente' }
 *   Crea hash de la contrasena (scrypt + salt) y lo guarda en pwd:<emailKey>.
 *   Solo permite signup si el email aun no tiene password.
 *
 * POST { action:'signin', email, password }
 *   Verifica el hash. Si coincide, busca el perfil en kv (pro o cli) por email
 *   y lo devuelve.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, email, password, role } = body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const emailKey = String(email).toLowerCase().trim();
    const pwdKey = 'pwd:' + emailKey;

    if (action === 'signup') {
      const existing = await kv.get(pwdKey);
      if (existing) {
        return res.status(409).json({ error: 'Ya existe una cuenta con este email. Inicia sesión.' });
      }
      const salt = randomBytes(16);
      const hash = await scrypt(password, salt, 64);
      await kv.set(pwdKey, {
        salt: salt.toString('hex'),
        hash: hash.toString('hex'),
        role: role === 'pro' ? 'pro' : 'cliente',
        createdAt: new Date().toISOString()
      });
      return res.status(200).json({ success: true, ready: true });
    }

    if (action === 'signin') {
      const stored = await kv.get(pwdKey);
      if (!stored) {
        return res.status(404).json({ error: 'No hay cuenta con ese email' });
      }
      const salt = Buffer.from(stored.salt, 'hex');
      const expected = Buffer.from(stored.hash, 'hex');
      const candidate = await scrypt(password, salt, 64);
      if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      // Localizar el perfil real (pro o cliente) por email
      const targetRole = stored.role || 'cliente';
      let profile = null;

      if (targetRole === 'pro') {
        const allPros = await kv.smembers('pros:all') || [];
        for (const pid of allPros) {
          const p = await kv.get('pro:' + pid);
          if (p && p.email && p.email.toLowerCase().trim() === emailKey) {
            profile = p;
            break;
          }
        }
      } else {
        const allClis = await kv.smembers('clientes:all') || [];
        for (const cid of allClis) {
          const c = await kv.get('cli:' + cid);
          if (c && c.email && c.email.toLowerCase().trim() === emailKey) {
            profile = c;
            break;
          }
        }
      }

      return res.status(200).json({
        success: true,
        role: targetRole,
        profile: profile,
        needsProfile: !profile
      });
    }

    return res.status(400).json({ error: 'action debe ser "signup" o "signin"' });

  } catch (e) {
    console.error('[auth-password] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
