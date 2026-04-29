import { Anthropic } from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  const anthropic = new Anthropic({ apiKey });

  try {
    const { nombre, oficios, descripcion, experiencia, certificaciones } = req.body;

    const prompt = `Eres un experto en marketing para profesionales de servicios. Escribe una biografía profesional impactante, convincente y vendedora para un profesional en MasterMatch Chile.
    
    Datos del profesional:
    - Nombre: ${nombre}
    - Oficios/Especialidades: ${oficios.join(', ')}
    - Descripción corta actual: ${descripcion}
    - Experiencia: ${experiencia}
    - Certificaciones: ${certificaciones}

    REGLAS:
    1. Usa un tono profesional pero cercano y confiable.
    2. Enfócate en los beneficios para el cliente (calidad, puntualidad, garantía).
    3. Usa español de Chile (claro y neutro, sin modismos excesivos).
    4. Longitud: entre 100 y 150 palabras.
    5. Estructura: Párrafo de introducción con propuesta de valor, párrafo de experiencia/especialidad, y cierre con invitación a contactar.
    6. Devuelve SOLO el texto de la biografía, sin preámbulos ni etiquetas.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const bio = response.content[0].text.trim();
    return res.status(200).json({ success: true, bio });

  } catch (e) {
    console.error('[IA Bio] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
