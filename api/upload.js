import { put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { fileName, fileData, proId, tipo, ownerId } = body;

    if (!fileData || !fileName) return res.status(400).json({ error: 'fileName y fileData obligatorios' });

    const matches = fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Formato invalido' });

    const mimeType = matches[1];
    const base64 = matches[2];
    const buffer = Buffer.from(base64, 'base64');

    // Limites por tipo
    const limites = {
      carnet: 5 * 1024 * 1024,        // 5MB
      antecedentes: 5 * 1024 * 1024,  // 5MB
      foto: 3 * 1024 * 1024,          // 3MB
      video: 25 * 1024 * 1024,        // 25MB
      documento: 8 * 1024 * 1024,     // 8MB
      solicitud: 8 * 1024 * 1024      // 8MB adjuntos cliente en chat
    };
    const maxSize = limites[tipo] || 3 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return res.status(400).json({ error: `Archivo muy grande. Max ${Math.round(maxSize/1024/1024)}MB` });
    }

    // Validar tipos permitidos
    const tiposMime = {
      carnet: ['image/jpeg', 'image/png', 'image/webp'],
      antecedentes: ['image/jpeg', 'image/png', 'application/pdf'],
      foto: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      video: ['video/mp4', 'video/quicktime', 'video/webm'],
      documento: ['application/pdf', 'image/jpeg', 'image/png'],
      solicitud: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
    };
    const permitidos = tiposMime[tipo] || tiposMime.foto;
    if (!permitidos.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido para ' + tipo });
    }

    const ext = mimeType.split('/')[1].split('+')[0] || 'bin';
    
    // Carpetas por tipo
    const carpetas = {
      carnet: 'docs',
      antecedentes: 'docs',
      foto: 'pros',
      video: 'pros/videos',
      documento: 'pros/documentos',
      solicitud: 'solicitudes'
    };
    const carpeta = carpetas[tipo] || 'pros';
    const owner = ownerId || proId || 'anon';
    const safeName = carpeta + '/' + owner + '/' + Date.now() + '.' + ext;

    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: mimeType
    });

    return res.status(200).json({ 
      success: true, 
      url: blob.url, 
      tipo: mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('image/') ? 'imagen' : 'documento',
      tamano: buffer.length
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error' });
  }
}
