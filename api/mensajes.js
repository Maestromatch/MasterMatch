import { kv } from '@vercel/kv';

/**
 * api/mensajes.js — Chat entre cliente y profesional post-match v10.7
 *
 * GET  ?solicitudId=XXX&desde=0         → mensajes desde timestamp
 * GET  ?solicitudId=XXX&action=info     → info del chat (participantes)
 * POST { solicitudId, remitente, rol, texto }   → enviar mensaje
 * POST { solicitudId, action:'leidos', rol }    → marcar como leídos
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ─── GET: obtener mensajes / info ───
    if (req.method === 'GET') {
      const { solicitudId, desde, action } = req.query;
      if (!solicitudId) return res.status(400).json({ error: 'solicitudId requerido' });

      if (action === 'info') {
        const chat = await kv.get('chat:' + solicitudId);
        return res.status(200).json({ success: true, chat: chat || null });
      }

      const msgs = (await kv.lrange('msgs:' + solicitudId, 0, -1)) || [];
      const desdeTs = parseInt(desde) || 0;
      const filtrados = desdeTs
        ? msgs.filter(m => m.ts > desdeTs)
        : msgs;
      return res.status(200).json({ success: true, mensajes: filtrados });
    }

    // ─── POST ───
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { solicitudId, action, remitente, rol, texto } = body;

      if (!solicitudId) return res.status(400).json({ error: 'solicitudId requerido' });

      // Marcar mensajes como leídos
      if (action === 'leidos') {
        const chat = await kv.get('chat:' + solicitudId) || {};
        if (rol === 'pro') chat.noLeidosPro = 0;
        if (rol === 'cliente') chat.noLeidosCliente = 0;
        await kv.set('chat:' + solicitudId, chat);
        return res.status(200).json({ success: true });
      }

      // Enviar mensaje
      if (!texto || !texto.trim()) return res.status(400).json({ error: 'Texto vacío' });
      if (!rol || !['pro', 'cliente'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

      const mensaje = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        remitente: (remitente || '').slice(0, 60),
        rol,
        texto: texto.trim().slice(0, 1000),
        ts: Date.now(),
        leido: false
      };

      // Guardar mensaje (lista Redis, máximo 200 mensajes)
      await kv.rpush('msgs:' + solicitudId, mensaje);
      const len = await kv.llen('msgs:' + solicitudId);
      if (len > 200) await kv.ltrim('msgs:' + solicitudId, len - 200, -1);

      // Actualizar info del chat (contador no leídos)
      const chat = (await kv.get('chat:' + solicitudId)) || {};
      chat.solicitudId = solicitudId;
      chat.ultimoMensaje = texto.trim().slice(0, 80);
      chat.ultimoTs = mensaje.ts;
      chat.ultimoRol = rol;
      if (rol === 'cliente') {
        chat.noLeidosPro = (chat.noLeidosPro || 0) + 1;
      } else {
        chat.noLeidosCliente = (chat.noLeidosCliente || 0) + 1;
      }
      await kv.set('chat:' + solicitudId, chat);
      await kv.expire('msgs:' + solicitudId, 60 * 60 * 24 * 90); // 90 días TTL
      await kv.expire('chat:' + solicitudId, 60 * 60 * 24 * 90);

      return res.status(200).json({ success: true, mensaje });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('[mensajes]', e);
    return res.status(500).json({ error: e.message });
  }
}
