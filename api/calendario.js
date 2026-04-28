import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // GET /api/calendario?proId=pro_xxx
      const proId = req.query.proId;
      if (!proId) return res.status(400).json({ error: 'proId requerido' });
      
      const cal = await kv.get(`cal:${proId}`) || { ocupados: [], vacaciones: [], horario: null };
      return res.status(200).json({ calendario: cal });
    }

    if (req.method === 'POST') {
      // Actualizar calendario
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { proId, ocupados, vacaciones, horario } = body;
      
      if (!proId) return res.status(400).json({ error: 'proId requerido' });

      const actual = await kv.get(`cal:${proId}`) || { ocupados: [], vacaciones: [], horario: null };
      const nuevo = {
        ocupados: ocupados !== undefined ? ocupados : actual.ocupados,
        vacaciones: vacaciones !== undefined ? vacaciones : actual.vacaciones,
        horario: horario !== undefined ? horario : actual.horario,
        actualizado: new Date().toISOString()
      };
      
      await kv.set(`cal:${proId}`, nuevo);
      return res.status(200).json({ success: true, calendario: nuevo });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
