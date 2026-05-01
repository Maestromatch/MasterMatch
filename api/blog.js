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
  },

  // === EXPANSIÓN v12.4.5: oficios de hogar ===
  carpinteria: {
    emoji: '🪵', nombre: 'Carpintería',
    resumen: 'Muebles a medida, reparaciones y trabajos en madera. Valores varían según el tipo de madera y acabado.',
    items: [
      { trabajo: 'Reparación puerta o ventana', rango: '$25.000 - $60.000', nota: 'Mano de obra, sin materiales' },
      { trabajo: 'Closet a medida (lineal)', rango: '$180.000 - $450.000', nota: 'Por metro lineal terminado' },
      { trabajo: 'Mueble de cocina completo', rango: '$900.000 - $3.500.000', nota: 'Madera nativa o melamina premium' }
    ],
    tips: ['Pide planos antes de fabricar', 'La melamina es 40% más barata pero dura menos que la madera maciza']
  },
  albanileria: {
    emoji: '🧱', nombre: 'Albañilería',
    resumen: 'Construcción menor, reparación de muros, estucos y cerámicas.',
    items: [
      { trabajo: 'Estuco interior m²', rango: '$8.000 - $15.000', nota: 'Mano de obra, mortero aparte' },
      { trabajo: 'Cerámica m² (instalación)', rango: '$12.000 - $22.000', nota: 'No incluye material ni adhesivo' },
      { trabajo: 'Construcción muro perimetral', rango: '$45.000 - $90.000', nota: 'Por m² con bloque y armadura' }
    ],
    tips: ['Verifica certificación si requiere cálculo estructural', 'El nivelado del piso es 30% del éxito de la cerámica']
  },
  cerrajeria: {
    emoji: '🔑', nombre: 'Cerrajería',
    resumen: 'Apertura, cambio y mantención de cerraduras y chapas. Servicio 24/7 en urgencias.',
    items: [
      { trabajo: 'Apertura puerta sin daño', rango: '$25.000 - $55.000', nota: 'Día normal; nocturno +50%' },
      { trabajo: 'Cambio de cerradura', rango: '$35.000 - $90.000', nota: 'Cilindro estándar o seguridad' },
      { trabajo: 'Instalación cerradura inteligente', rango: '$80.000 - $250.000', nota: 'Bluetooth o WiFi, sin material' }
    ],
    tips: ['Exige boleta y RUT del técnico antes de empezar', 'Cambia cerraduras al mudarte siempre']
  },
  jardineria: {
    emoji: '🌿', nombre: 'Jardinería',
    resumen: 'Mantención de áreas verdes, poda, paisajismo e instalación de pasto.',
    items: [
      { trabajo: 'Mantención mensual jardín chico', rango: '$35.000 - $70.000', nota: 'Hasta 100m², 2 visitas al mes' },
      { trabajo: 'Poda de árbol mediano', rango: '$45.000 - $120.000', nota: 'Hasta 5m de altura' },
      { trabajo: 'Instalación pasto rollo m²', rango: '$8.000 - $14.000', nota: 'Incluye preparación de suelo' }
    ],
    tips: ['Riego automático ahorra 40% de agua', 'La poda en invierno (junio-agosto) es la más sana para el árbol']
  },
  climatizacion: {
    emoji: '❄️', nombre: 'Climatización (Aire/Calefacción)',
    resumen: 'Instalación y mantención de aire acondicionado, calefacción a gas y bombas de calor.',
    items: [
      { trabajo: 'Instalación split A/A', rango: '$120.000 - $280.000', nota: 'Hasta 12.000 BTU, sin equipo' },
      { trabajo: 'Mantención anual A/A', rango: '$35.000 - $70.000', nota: 'Limpieza filtros y revisión gas' },
      { trabajo: 'Recarga de gas refrigerante', rango: '$45.000 - $110.000', nota: 'Según tipo (R32, R410A)' }
    ],
    tips: ['La mantención anual extiende la vida útil un 30%', 'Pide certificación SEC si hay manipulación de gas']
  },
  limpieza: {
    emoji: '🧹', nombre: 'Limpieza Profunda',
    resumen: 'Limpieza de hogar, post-obra o de oficinas. Productos incluidos.',
    items: [
      { trabajo: 'Limpieza profunda casa 60m²', rango: '$45.000 - $80.000', nota: '4-6 horas, equipo de 2 personas' },
      { trabajo: 'Limpieza post-obra', rango: '$120.000 - $350.000', nota: 'Según m² y nivel de polvo/escombros' },
      { trabajo: 'Limpieza de oficina recurrente', rango: '$25.000 - $55.000', nota: 'Por visita, mínimo 4 al mes' }
    ],
    tips: ['Solicita boleta y seguro contra robos', 'Frecuencia quincenal mantiene mejor el hogar']
  },
  cuidadora: {
    emoji: '💊', nombre: 'Cuidado de Enfermos / Adultos Mayores',
    resumen: 'Acompañamiento, asistencia básica y cuidados profesionales en domicilio.',
    items: [
      { trabajo: 'Acompañamiento (8h diarias)', rango: '$28.000 - $45.000', nota: 'Sin labores médicas' },
      { trabajo: 'Cuidado especializado (24h)', rango: '$60.000 - $110.000', nota: 'Con curaciones y medicamentos' },
      { trabajo: 'Turno nocturno (12h)', rango: '$35.000 - $65.000', nota: 'Bonificado para feriados' }
    ],
    tips: ['Verifica certificación de Sence o título técnico', 'Establece contrato laboral formal por más de 30 horas semanales']
  },
  cuidadoinfantil: {
    emoji: '👶', nombre: 'Cuidado Infantil / Niñera',
    resumen: 'Cuidado de niños 0-12 años, recogida del colegio, apoyo en tareas.',
    items: [
      { trabajo: 'Niñera por hora', rango: '$5.000 - $9.000', nota: 'Tarifa base; nocturno +30%' },
      { trabajo: 'Jornada completa diaria', rango: '$30.000 - $55.000', nota: '8 horas, hasta 2 niños' },
      { trabajo: 'Niñera con experiencia educacional', rango: '$8.000 - $14.000', nota: 'Por hora; refuerzo escolar incluido' }
    ],
    tips: ['Pide referencias verificables y certificado de antecedentes', 'Acuerda emergencias y permisos médicos por escrito']
  },
  fumigacion: {
    emoji: '🐜', nombre: 'Fumigación / Control de Plagas',
    resumen: 'Eliminación de roedores, insectos y plagas urbanas. Aplicación con autorización ISP.',
    items: [
      { trabajo: 'Fumigación casa 80m²', rango: '$45.000 - $90.000', nota: 'Aplicación única; garantía 30 días' },
      { trabajo: 'Control de termitas', rango: '$180.000 - $550.000', nota: 'Tratamiento integral; revisión a 6 meses' },
      { trabajo: 'Control de pulgas/garrapatas', rango: '$55.000 - $120.000', nota: 'Casa con mascotas; 2 aplicaciones' }
    ],
    tips: ['Exige certificado de aplicación con número de ISP', 'Ventila 4 horas mínimo antes de volver a habitar']
  },
  tecelectro: {
    emoji: '📺', nombre: 'Téc. Electrodomésticos',
    resumen: 'Reparación de lavadoras, refrigeradores, hornos, microondas y línea blanca.',
    items: [
      { trabajo: 'Diagnóstico domicilio', rango: '$15.000 - $30.000', nota: 'Deducible del trabajo' },
      { trabajo: 'Reparación lavadora', rango: '$35.000 - $120.000', nota: 'Sin repuestos; según falla' },
      { trabajo: 'Cambio compresor refrigerador', rango: '$120.000 - $280.000', nota: 'Repuesto + mano de obra' }
    ],
    tips: ['Pide repuesto original o garantía 6 meses', 'A veces conviene comprar nuevo si la reparación supera el 50% del precio']
  },
  piscinas: {
    emoji: '🏊', nombre: 'Mantención de Piscinas',
    resumen: 'Limpieza, equilibrio químico, reparación de filtros y bombas.',
    items: [
      { trabajo: 'Mantención semanal', rango: '$25.000 - $50.000', nota: 'Por visita; químicos aparte' },
      { trabajo: 'Apertura temporada (drenaje + llenado)', rango: '$80.000 - $180.000', nota: 'Una vez al año' },
      { trabajo: 'Reparación bomba/filtro', rango: '$60.000 - $250.000', nota: 'Diagnóstico + repuesto' }
    ],
    tips: ['Mantén el pH entre 7.2 y 7.6', 'Cubre la piscina en invierno: ahorra hasta 60% en químicos']
  },

  // === Servicios profesionales adicionales ===
  enfermero: {
    emoji: '💉', nombre: 'Enfermero/a',
    resumen: 'Atención de enfermería en domicilio: curaciones, inyectables, control vital.',
    items: [
      { trabajo: 'Visita curación', rango: '$18.000 - $35.000', nota: 'Por visita; insumos aparte' },
      { trabajo: 'Inyección intramuscular', rango: '$8.000 - $15.000', nota: 'A domicilio' },
      { trabajo: 'Turno completo (12h)', rango: '$80.000 - $150.000', nota: 'Acompañamiento clínico' }
    ],
    tips: ['Solicita registro en Superintendencia de Salud', 'Reembolsable parcialmente con bono Fonasa/Isapre']
  },
  kinesiologo: {
    emoji: '🏃', nombre: 'Kinesiólogo/a',
    resumen: 'Rehabilitación de lesiones, kinesiterapia respiratoria y deportiva.',
    items: [
      { trabajo: 'Sesión domicilio (45-60 min)', rango: '$30.000 - $55.000', nota: 'Reembolsable bono' },
      { trabajo: 'Sesión consulta', rango: '$22.000 - $40.000', nota: 'En centro propio' },
      { trabajo: 'Programa 10 sesiones', rango: '$220.000 - $450.000', nota: 'Pack post operatorio' }
    ],
    tips: ['Pide plan de tratamiento por escrito', 'La constancia (3 sesiones/semana) acelera la recuperación 2x']
  },
  nutricionista: {
    emoji: '🥗', nombre: 'Nutricionista',
    resumen: 'Pautas alimentarias personalizadas, deportivas o terapéuticas.',
    items: [
      { trabajo: 'Primera consulta + pauta', rango: '$30.000 - $55.000', nota: 'Online o presencial' },
      { trabajo: 'Control de seguimiento', rango: '$18.000 - $32.000', nota: 'Cada 3-4 semanas' },
      { trabajo: 'Plan deportivo trimestral', rango: '$120.000 - $250.000', nota: 'Incluye 3 controles + ajustes' }
    ],
    tips: ['Verifica registro vigente en Colegio de Nutricionistas', 'Cambios sostenibles >dietas restrictivas']
  },
  arquitecto: {
    emoji: '📐', nombre: 'Arquitecto',
    resumen: 'Proyectos de obra nueva, ampliaciones, regularizaciones DOM y diseño interior.',
    items: [
      { trabajo: 'Anteproyecto vivienda', rango: '$350.000 - $1.200.000', nota: 'Planos preliminares' },
      { trabajo: 'Proyecto completo + permiso DOM', rango: '$1.500.000 - $6.000.000', nota: 'Hasta 200m² construidos' },
      { trabajo: 'Regularización Ley del Mono', rango: '$450.000 - $1.500.000', nota: 'Según m² ya construidos' }
    ],
    tips: ['Exige timbre del Colegio de Arquitectos', 'El permiso DOM es obligatorio para vender la propiedad']
  },
  contador: {
    emoji: '📊', nombre: 'Contador',
    resumen: 'Asesoría contable, declaración de renta, IVA mensual, sueldos y constitución de empresas.',
    items: [
      { trabajo: 'Renta persona natural', rango: '$25.000 - $80.000', nota: 'Una vez al año (abril)' },
      { trabajo: 'Asesoría mensual PyME', rango: '$80.000 - $250.000', nota: 'IVA + sueldos hasta 5 trabajadores' },
      { trabajo: 'Constitución de SpA', rango: '$120.000 - $350.000', nota: 'Sin notaría incluida' }
    ],
    tips: ['Pide referencias y prueba con el primer mes', 'Un buen contador te ahorra más impuestos que su honorario']
  },

  // === Digitales adicionales ===
  marketingdigital: {
    emoji: '📊', nombre: 'Marketing Digital / Community Manager',
    resumen: 'Gestión de redes, campañas pagadas en Meta y Google, contenido y crecimiento.',
    items: [
      { trabajo: 'Community Manager mensual', rango: '$180.000 - $450.000', nota: '12-20 publicaciones, sin pauta' },
      { trabajo: 'Campaña Meta Ads', rango: '$250.000 - $650.000', nota: 'Honorario; presupuesto pauta aparte' },
      { trabajo: 'Estrategia de marca + 1 mes', rango: '$450.000 - $1.200.000', nota: 'Auditoría + plan + ejecución' }
    ],
    tips: ['Pide ROI/ROAS por escrito mensual', 'No confundas pauta (lo que pagas a Meta) con honorario del CM']
  },
  fotografo: {
    emoji: '📸', nombre: 'Fotógrafo Profesional',
    resumen: 'Sesiones para producto, retrato, eventos y contenido de redes.',
    items: [
      { trabajo: 'Sesión retrato 1h', rango: '$80.000 - $180.000', nota: '20-30 fotos editadas' },
      { trabajo: 'Producto pack 10 fotos', rango: '$150.000 - $350.000', nota: 'Fondo blanco + ambientación' },
      { trabajo: 'Cobertura evento (4h)', rango: '$250.000 - $600.000', nota: '150 fotos editadas + galería online' }
    ],
    tips: ['Pide preview de 5 fotos antes de la edición final', 'Los archivos RAW suelen costar 30-50% extra']
  },
  editorvideo: {
    emoji: '🎬', nombre: 'Editor de Video',
    resumen: 'Edición de reels, podcasts, contenido para YouTube y videos corporativos.',
    items: [
      { trabajo: 'Reel 30s editado', rango: '$25.000 - $70.000', nota: 'Cortes, subtítulos, música' },
      { trabajo: 'Video YouTube 10 min', rango: '$80.000 - $250.000', nota: 'Edición + thumbnails + intro' },
      { trabajo: 'Pack mensual 12 reels', rango: '$280.000 - $650.000', nota: 'Estrategia + edición' }
    ],
    tips: ['Define el estilo en un brief con referencias', 'Un editor que entrega en 48h vale el doble del que tarda 1 semana']
  },
  consultoria: {
    emoji: '🤖', nombre: 'Consultor IA / Automatización',
    resumen: 'Implementación de IA, chatbots, automatizaciones n8n/Make/Zapier para PyMEs.',
    items: [
      { trabajo: 'Diagnóstico y roadmap', rango: '$150.000 - $400.000', nota: '2-3 sesiones; entregable' },
      { trabajo: 'Chatbot WhatsApp Business', rango: '$350.000 - $1.200.000', nota: 'Integración + training' },
      { trabajo: 'Automatización de procesos', rango: '$280.000 - $900.000', nota: 'Por flujo (ventas, postventa, etc)' }
    ],
    tips: ['Mide el ahorro de horas antes y después', 'Empieza por el proceso más repetitivo (90% del valor)']
  },

  // === Eventos adicionales ===
  dj: {
    emoji: '🎧', nombre: 'DJ Profesional',
    resumen: 'Música para matrimonios, fiestas privadas y eventos corporativos.',
    items: [
      { trabajo: 'Cumpleaños 4 horas', rango: '$180.000 - $350.000', nota: 'Equipo básico incluido' },
      { trabajo: 'Matrimonio 6-8 horas', rango: '$450.000 - $1.200.000', nota: 'Sonido pro + iluminación' },
      { trabajo: 'Evento corporativo', rango: '$350.000 - $800.000', nota: 'Hasta 200 personas' }
    ],
    tips: ['Pide demo en vivo si puedes', 'Acuerda playlist y géneros prohibidos por escrito']
  },
  bartender: {
    emoji: '🍹', nombre: 'Bartender',
    resumen: 'Coctelería para eventos, cumpleaños y fiestas privadas.',
    items: [
      { trabajo: 'Bartender 4h (hasta 30 personas)', rango: '$120.000 - $250.000', nota: 'Sin destilados ni insumos' },
      { trabajo: 'Open bar 6h con barra completa', rango: '$350.000 - $850.000', nota: 'Insumos premium incluidos' },
      { trabajo: 'Pack cocteles personalizados', rango: '$80.000 - $180.000', nota: '3 recetas + 50 unidades' }
    ],
    tips: ['Calcula 4 tragos por persona en eventos largos', 'Define menú con 1-2 cocteles signature, no 10']
  },
  decorador: {
    emoji: '🎈', nombre: 'Decorador de Eventos',
    resumen: 'Ambientación con globos, telas, mesas dulces y decoración temática.',
    items: [
      { trabajo: 'Arco de globos básico', rango: '$45.000 - $120.000', nota: '2-3m, instalación incluida' },
      { trabajo: 'Decoración matrimonio completo', rango: '$450.000 - $1.500.000', nota: 'Centros mesa + arco + cartel' },
      { trabajo: 'Mesa dulce para cumpleaños', rango: '$120.000 - $350.000', nota: 'Hasta 30 invitados' }
    ],
    tips: ['Pide fotos de eventos reales (no Pinterest)', 'Confirma horario de instalación y retiro por escrito']
  }
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
