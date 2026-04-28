// Blog de precios referenciales MasterMatch v11.0
// Fuentes: Análisis de mercado de servicios en Chile (datos 2026)
// Factor regional: Santiago = 1.0, Valparaíso = 0.90, Biobío = 0.85, Los Ríos = 0.83, Los Lagos = 0.82

const PRECIOS_BASE = {
  // --- OFICIOS (Construcción y Hogar) ---
  gasfiteria: {
    emoji: '🔧', nombre: 'Gasfitería',
    resumen: 'Servicios de agua, gas y calefacción. La hora de urgencia en 2026 ha subido un 15% respecto al año anterior.',
    items: [
      { trabajo: 'Visita diagnóstica', rango: '$15.000 - $30.000', nota: 'Deducible si se realiza el trabajo' },
      { trabajo: 'Instalación Calefont', rango: '$70.000 - $130.000', nota: 'Solo mano de obra certificado SEC' },
      { trabajo: 'Destape de alcantarillado', rango: '$45.000 - $180.000', nota: 'Según metraje y obstrucción' }
    ],
    tips: ['Exige siempre sello verde en instalaciones de gas', 'Los materiales suelen ser un 30% del costo total']
  },
  electricidad: {
    emoji: '⚡', nombre: 'Electricidad',
    resumen: 'Instalaciones eléctricas certificadas. Los precios incluyen el riesgo y la certificación SEC si aplica.',
    items: [
      { trabajo: 'Punto de luz/enchufe', rango: '$25.000 - $45.000', nota: 'Mano de obra por unidad' },
      { trabajo: 'Certificación TE1', rango: '$120.000 - $350.000', nota: 'Trámite completo ante la SEC' },
      { trabajo: 'Tablero eléctrico casa', rango: '$200.000 - $500.000', nota: 'Actualización a normativa 2026' }
    ],
    tips: ['No permitas intervenciones de personal no calificado', 'El tablero es el corazón de la seguridad de tu hogar']
  },
  pintura: {
    emoji: '🎨', nombre: 'Pintura',
    resumen: 'Renovación de espacios interiores y exteriores. Valores por m² con preparación de muro.',
    items: [
      { trabajo: 'Mano de obra m² interior', rango: '$3.500 - $6.000', nota: '2 manos de pintura' },
      { trabajo: 'Pintura fachada (altura)', rango: '$6.000 - $12.000', nota: 'Incluye andamiaje básico' }
    ],
    tips: ['La calidad de la pintura define la duración (3 vs 8 años)', 'Lijar y sellar es el 60% del trabajo bien hecho']
  },
  flete: {
    emoji: '🚛', nombre: 'Flete y Mudanzas',
    resumen: 'Transporte de carga y mudanzas locales o interregionales.',
    items: [
      { trabajo: 'Flete comunal simple', rango: '$25.000 - $45.000', nota: 'Solo transporte, carga propia' },
      { trabajo: 'Mudanza casa 3D/2B', rango: '$180.000 - $450.000', nota: 'Incluye peonetas y embalaje' }
    ],
    tips: ['Reserva con 1 semana de anticipación', 'El inventario detallado evita malentendidos']
  },

  // --- SERVICIOS PROFESIONALES (Salud y Leyes) ---
  doctor: {
    emoji: '👨‍⚕️', nombre: 'Doctor Particular',
    resumen: 'Atención médica domiciliaria o telemedicina. Valores por consulta de 30-45 min.',
    items: [
      { trabajo: 'Consulta general domicilio', rango: '$45.000 - $85.000', nota: 'Sujeto a disponibilidad' },
      { trabajo: 'Telemedicina', rango: '$25.000 - $45.000', nota: 'Emisión de recetas y licencias' }
    ],
    tips: ['Verifica el registro en la Superintendencia de Salud', 'Ideal para adultos mayores o movilidad reducida']
  },
  psicologo: {
    emoji: '🧠', nombre: 'Psicología',
    resumen: 'Terapia individual, de pareja o infantil. Modalidad presencial u online.',
    items: [
      { trabajo: 'Sesión individual (45 min)', rango: '$35.000 - $60.000', nota: 'Reembolsable por Isapre/Fonasa' },
      { trabajo: 'Terapia de pareja', rango: '$45.000 - $80.000', nota: 'Sesiones de 60-70 min' }
    ],
    tips: ['La continuidad es clave para el éxito del tratamiento', 'Pregunta por el enfoque terapéutico (Cognitivo, Humanista, etc)']
  },
  abogado: {
    emoji: '⚖️', nombre: 'Abogado',
    resumen: 'Asesoría legal y representación. Los honorarios pueden ser por hora o cuota litis.',
    items: [
      { trabajo: 'Consulta legal', rango: '$40.000 - $90.000', nota: 'Deducible si se toma el caso' },
      { trabajo: 'Divorcio mutuo acuerdo', rango: '$350.000 - $700.000', nota: 'Más gastos judiciales' }
    ],
    tips: ['Siempre firma un contrato de honorarios', 'Pide transparencia en los plazos judiciales']
  },

  // --- DIGITALES (Servicios Remotos) ---
  programador: {
    emoji: '💻', nombre: 'Programador / Web',
    resumen: 'Desarrollo de sitios web, apps y automatizaciones para negocios.',
    items: [
      { trabajo: 'Landing Page simple', rango: '$150.000 - $450.000', nota: 'Optimizado para ventas' },
      { trabajo: 'Ecommerce Completo', rango: '$600.000 - $2.500.000', nota: 'Shopify, WooCommerce o Custom' }
    ],
    tips: ['El soporte post-entrega es vital', 'Asegúrate de ser dueño de tu dominio y hosting']
  },
  disenografico: {
    emoji: '📱', nombre: 'Diseño Gráfico',
    resumen: 'Identidad visual, logos y material para redes sociales.',
    items: [
      { trabajo: 'Diseño de Logo', rango: '$80.000 - $250.000', nota: 'Incluye manual de marca básico' },
      { trabajo: 'Pack RRSS (10 post)', rango: '$60.000 - $120.000', nota: 'Diseño para Instagram/FB' }
    ],
    tips: ['Pide los archivos originales (editables)', 'El diseño debe hablarle a tu cliente ideal']
  },

  // --- EVENTOS ---
  musico: {
    emoji: '🎸', nombre: 'Músico / Banda',
    resumen: 'Música en vivo para matrimonios, eventos corporativos o locales.',
    items: [
      { trabajo: 'Solista (2 tandas 45min)', rango: '$120.000 - $250.000', nota: 'Incluye amplificación básica' },
      { trabajo: 'Banda completa', rango: '$450.000 - $1.500.000', nota: 'Depende de integrantes y equipo' }
    ],
    tips: ['Revisa videos de presentaciones reales antes', 'Define bien el setlist y el estilo musical']
  },
  animadorinfantil: {
    emoji: '🤡', nombre: 'Animación Infantil',
    resumen: 'Cumpleaños y eventos escolares. Magia, juegos y globoflexia.',
    items: [
      { trabajo: 'Show básico (2 horas)', rango: '$60.000 - $110.000', nota: 'Hasta 20 niños' },
      { trabajo: 'Show Premium (con corpóreo)', rango: '$120.000 - $220.000', nota: 'Incluye premios y sonido' }
    ],
    tips: ['Pide referencias de otros padres', 'Asegúrate de que el contenido sea apto para la edad']
  },
  conductor: {
    emoji: '🚗', nombre: 'Conductor / RentCar',
    resumen: 'Servicio de conductor privado o arriendo de vehículo con chofer.',
    items: [
      { trabajo: 'Traslado Aeropuerto (RM)', rango: '$25.000 - $45.000', nota: 'Según comuna y horario' },
      { trabajo: 'Chofer por jornada (8h)', rango: '$80.000 - $150.000', nota: 'Vehículo del cliente o pro' }
    ],
    tips: ['Verifica licencia de conducir vigente', 'El seguro de pasajeros es obligatorio para servicios pro']
  }
  // ... Se expandirán los 62 oficios siguiendo este patrón en la lógica del handler
};

// Ajuste regional (Santiago 1.0, Valparaíso 0.90, Biobío 0.85, Los Ríos 0.83, Los Lagos 0.82)
const FACTORES_REGION = {
  'Metropolitana': 1.0,
  'Valparaiso': 0.90,
  'Biobio': 0.85,
  'LosRios': 0.83,
  'LosLagos': 0.82
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const oficio = (req.query.oficio || '').toLowerCase();
  const region = req.query.region || 'Metropolitana';

  if (oficio) {
    const info = PRECIOS_BASE[oficio];
    if (!info) return res.status(404).json({ error: 'Oficio no encontrado' });
    return res.status(200).json({ 
      oficio, 
      region, 
      factor: FACTORES_REGION[region] || 1.0,
      info 
    });
  }

  // Listado general (Se devuelven los 12 principales para el blog público)
  const lista = Object.keys(PRECIOS_BASE).map(k => ({
    key: k,
    emoji: PRECIOS_BASE[k].emoji,
    nombre: PRECIOS_BASE[k].nombre,
    resumen: PRECIOS_BASE[k].resumen
  }));

  return res.status(200).json({ 
    blog: lista, 
    region, 
    factor: FACTORES_REGION[region] || 1.0,
    actualizado: 'Abril 2026',
    fuentes: ['analisis-mercado-chile-2026']
  });
}
