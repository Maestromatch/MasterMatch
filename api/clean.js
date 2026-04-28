import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.query.secret !== 'masterclean2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const pros = await kv.get('mm_profesionales') || [];
    const sols = await kv.get('mm_solicitudes') || [];

    // 1. Limpiar Pros (Duplicados y Pruebas)
    const uniquePros = [];
    const seenWa = new Set();
    const removedPros = [];

    pros.forEach(p => {
      const isTest = /test|prueba|asdf|123/i.test(p.nombre) || /test|prueba/i.test(p.descripcion || '');
      const isDup = seenWa.has(p.whatsapp);
      
      if (!isTest && !isDup) {
        uniquePros.push(p);
        seenWa.add(p.whatsapp);
      } else {
        removedPros.push(p.nombre);
      }
    });

    // 2. Limpiar Solicitudes (Pruebas)
    const cleanSols = sols.filter(s => {
      const isTest = /test|prueba|asdf|123/i.test(s.descripcion || '') || /test|prueba/i.test(s.tipo || '');
      return !isTest;
    });

    await kv.set('mm_profesionales', uniquePros);
    await kv.set('mm_solicitudes', cleanSols);

    return res.json({
      success: true,
      removedPros,
      prosRemaining: uniquePros.length,
      solsRemaining: cleanSols.length
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
