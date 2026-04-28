import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { proId, estrellas, comentario, nombreCliente, foto, solicitudId } = body;

      if (!proId || !estrellas) return res.status(400).json({ error: 'proId y estrellas obligatorios' });
      const rating = Math.min(5, Math.max(1, parseInt(estrellas)));
      const pro = await kv.get('pro:' + proId);
      if (!pro) return res.status(404).json({ error: 'No encontrado' });

      const reviewId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const review = {
        id: reviewId, proId, estrellas: rating,
        comentario: (comentario || '').trim().slice(0, 500),
        nombreCliente: (nombreCliente || 'Cliente').trim().slice(0, 50),
        foto: foto || '',
        solicitudId: solicitudId || '',
        fecha: new Date().toISOString()
      };

      await kv.set('rev:' + reviewId, review);
      await kv.sadd('revs:pro:' + proId, reviewId);

      if (!pro.reviews) pro.reviews = [];
      pro.reviews.unshift(review);
      pro.reviews = pro.reviews.slice(0, 20);
      pro.reviewCount = (pro.reviewCount || 0) + 1;
      const totalStars = pro.reviews.reduce((sum, r) => sum + r.estrellas, 0);
      pro.rating = totalStars / pro.reviews.length;

      await kv.set('pro:' + proId, pro);
      return res.status(200).json({ success: true, review });
    }

    if (req.method === 'GET') {
      const { proId } = req.query;
      if (!proId) return res.status(400).json({ error: 'proId requerido' });

      const pro = await kv.get('pro:' + proId);
      if (!pro) return res.status(404).json({ error: 'No encontrado' });

      return res.status(200).json({
        reviews: pro.reviews || [],
        rating: pro.rating || 0,
        total: pro.reviewCount || 0
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
