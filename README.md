# MasterMatch v11.0 (Executive Edition)

**Plataforma chilena que conecta clientes con profesionales verificados.**
Soluciones de primera, profesionales de verdad.

---

## 🎯 Resumen del producto

MasterMatch es un marketplace de servicios profesionales que combina:
- **IA filtradora**: entrevista al cliente antes de enviar la solicitud al pro
- **Verificación con carnet** y documentos por oficio
- **Pago Protegido** vía Mercado Pago (dinero retenido hasta confirmar trabajo)
- **5 regiones**: Metropolitana, Valparaíso, Biobío, Los Ríos, Los Lagos
- **62 categorías** organizadas en Oficios, Profesionales, Digitales y Eventos.
- **Open Match nacional**: telemedicina y servicios remotos entre regiones
- **Executive Dashboard**: Panel profesional premium con métricas de Billetera (Escrow).

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | HTML/CSS/JS vanilla single-file (`index.html`) |
| Hosting | Vercel |
| Base de datos | Vercel KV (Redis Upstash) |
| Almacenamiento | Vercel Blob |
| Autenticación social | Firebase Auth (Google) |
| IA conversacional | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Pagos | Mercado Pago Chile (SDK v2.0.15) |
| Email | Resend |

---

## 📂 Estructura del repositorio

```
/
├── index.html               # SPA completa con todas las pantallas
├── package.json             # Dependencias Vercel
├── api/
│   ├── _security.js         # Helper sanitización + rate limit
│   ├── auth.js              # Firebase Google login + búsqueda email
│   ├── chat.js              # Claude API con sistema 3 niveles
│   ├── profesionales.js     # CRUD perfiles profesionales
│   ├── clientes.js          # CRUD clientes (registro +18, captcha)
│   ├── solicitudes.js       # Solicitudes de trabajo
│   ├── reviews.js           # Reseñas con cálculo de promedio
│   ├── pagos.js             # Mercado Pago + webhook
│   ├── leads.js             # Solicitudes externas (sin cuenta)
│   ├── verificacion.js      # Subida de documentos a Blob
│   ├── calendario.js        # Disponibilidad agenda
│   ├── blog.js              # Tablas de precios con factor regional
│   ├── upload.js            # Subida de fotos a Blob
│   └── admin.js             # Panel admin (verificar, eliminar, stats)
└── README.md
```

---

## 🔐 Variables de entorno (Vercel)

```
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
ADMIN_PASSWORD=tu_password_secreto
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
MERCADOPAGO_ACCESS_TOKEN=APP_USR-... (o TEST-... para pruebas)
SITE_URL=https://master-match.vercel.app
```

---

## 🎨 Sistema de diseño

**Paleta v9.x — Turquesa**
- Primario: `#00C9B1`
- Hover: `#00A896`
- Tint: `#E0F9F5`
- Profundo: `#006666`
- Background dark: `#0C0F10`
- Dorado (Premium): `#C9A84C`

**Tipografía**: Space Grotesk (única, peso 400-800).

---

## 📦 Plan de funcionalidades (versiones)

| Versión | Hito |
|---|---|
| v9.0 | Rebrand a MasterMatch + paleta turquesa |
| v9.1 | Splash screen + paleta oficial brief |
| v9.2 | Login social (Google) reubicado dentro de cada formulario de rol |
| v9.3 | 5 regiones (+Los Ríos +Los Lagos) y 38 oficios |
| v9.4 | Chat IA en 3 niveles + ganchos de conversión (lost-banner) |
| v9.5 | Verificación documentos por oficio (carnet, antecedentes, título, licencia) |
| v9.6 | Monetización del cliente (Premium $1.990 + Cotización Exprés $990) |
| v9.7 | Anti-fuga + helper de seguridad común (`api/_security.js`) |
| v9.8 | UX premium: testimoniales rotativos + contador en vivo |
| v10.5 | Sistema de Cupones (Win-Back) y Modo Dios Admin |
| v11.0 | Relanzamiento Executive: Rediseño Premium, Muro editable y Blindaje Legal Chile |

---

## 🚀 Despliegue

```bash
# 1. Clonar
git clone https://github.com/Maestromatch/Mastermatch.html
cd Mastermatch.html

# 2. Conectar a Vercel (primera vez)
vercel link

# 3. Deploy
vercel --prod
```

El dominio `master-match.vercel.app` apunta al `main` de este repo.

---

## 🧪 Tarjetas de prueba Mercado Pago (Chile)

- Visa Débito: `4509 9535 6623 3704`
- CVV: `123`
- Vencimiento: cualquiera futura
- Titular: `APRO` (aprueba), `OTHE` (rechaza)
- RUT: `12345678-5`

---

## 📞 Contacto operativo

- Email principal: saul.constructor25@gmail.com
- Instagram: [@saul_el_constructor](https://instagram.com/saul_el_constructor)
- Repo: [Maestromatch/Mastermatch.html](https://github.com/Maestromatch/Mastermatch.html)

---

## ⚖️ Licencia

Propiedad de Saul Iván Irribarra. Todos los derechos reservados.
