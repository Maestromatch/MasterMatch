/**
 * api/_security.js — Utilidades de seguridad reutilizables v9.7
 * Sanitización XSS, validación, rate limiting básico
 */

// Sanitización contra XSS — escapa caracteres peligrosos en strings
export function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')                           // remueve < y >
    .replace(/javascript:/gi, '')                   // bloquea javascript:
    .replace(/on\w+\s*=/gi, '')                     // bloquea onclick=, onerror=, etc
    .replace(/data:text\/html/gi, '')               // bloquea data URIs html
    .trim()
    .slice(0, maxLen);
}

// Sanitización profunda de objetos
export function sanitizeObject(obj, schema = {}) {
  if (!obj || typeof obj !== 'object') return {};
  const clean = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const maxLen = schema[key] || 500;
    if (typeof val === 'string') {
      clean[key] = sanitizeString(val, maxLen);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    } else if (Array.isArray(val)) {
      clean[key] = val.slice(0, 50).map(item => 
        typeof item === 'string' ? sanitizeString(item, maxLen) : item
      );
    } else if (val !== null && typeof val === 'object') {
      clean[key] = sanitizeObject(val, schema);
    }
  }
  return clean;
}

// Validar email
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 200;
}

// Validar WhatsApp chileno
export function isValidWhatsApp(num) {
  if (typeof num !== 'string') return false;
  const cleaned = num.replace(/[\s\-\+]/g, '');
  return /^(56)?[2-9]\d{8}$/.test(cleaned);
}

// Validar RUT chileno (formato básico)
export function isValidRut(rut) {
  if (typeof rut !== 'string') return false;
  const cleaned = rut.replace(/[\.\-\s]/g, '').toUpperCase();
  return /^\d{7,8}[0-9K]$/.test(cleaned);
}

// Rate limiter en memoria (por IP) — por endpoint
const rateLimits = new Map();

export function checkRateLimit(req, key = 'global', maxPerMinute = 30) {
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const ipKey = key + ':' + ip;
  const now = Date.now();
  const cutoff = now - 60000; // 1 minuto

  let timestamps = rateLimits.get(ipKey) || [];
  timestamps = timestamps.filter(t => t > cutoff);

  if (timestamps.length >= maxPerMinute) {
    return { allowed: false, count: timestamps.length };
  }

  timestamps.push(now);
  rateLimits.set(ipKey, timestamps);
  
  // Limpieza periódica del Map (evita memory leak)
  if (rateLimits.size > 10000) {
    for (const [k, v] of rateLimits) {
      if (v.length === 0 || v[v.length - 1] < cutoff) rateLimits.delete(k);
    }
  }

  return { allowed: true, count: timestamps.length };
}

// Headers CORS y seguridad estandar
export function setSecurityHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// Validar webhook de Mercado Pago (firma básica)
export function isValidMpWebhook(req) {
  // En producción real se valida la firma con MP_SIGNATURE_KEY.
  // Por ahora validamos que tenga estructura mínima esperada.
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !body.type) return false;
    return ['payment', 'merchant_order', 'subscription_preapproval'].includes(body.type);
  } catch (e) {
    return false;
  }
}
