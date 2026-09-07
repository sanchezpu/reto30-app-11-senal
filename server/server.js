// Señal — API de auditoría de píxeles y eventos de conversión.
//
// Cero dependencias a propósito: node 22 trae `http`, `https`, `dns` y `net`,
// así que el contenedor no lleva node_modules y desplegar es copiar un archivo.
//
// ⚠️ Cuatro cosas de este archivo importan más que el resto:
//
//   1. EL GUARDIÁN DE DESTINO. Esta API descarga URLs que escribe un
//      desconocido y corre en la MISMA red docker que el Postgres del reto y
//      los servicios del cliente. Sin filtro, cualquiera pediría
//      http://reto30_informes-db:5432 y usaría esta app como puerta de entrada
//      (SSRF). Se valida el DNS a mano, se fija la IP con la que se conecta, se
//      revalida cada redirección Y se juzgan aparte las IP literales: si el
//      host ya es una IP, node NO llama a `lookup` y el guardián no correría.
//
//   2. EL CONTENEDOR DE GTM. Es lo que separa esta herramienta de un
//      «buscar fbq en el HTML». gtm.js es público, cuesta una petición y trae
//      dentro las etiquetas que el HTML no enseña. Sin él no hay hallazgo de
//      píxel duplicado, que es el diagnóstico que de verdad cuesta dinero.
//
//   3. LA CUENTA DE CARGAS, NO DE COINCIDENCIAS. El mismo píxel aparece varias
//      veces en una página sin estar duplicado: el `fbq('init')` y su
//      `<noscript>` son UNA instalación. Duplicado es que el ID se INICIE desde
//      dos sitios distintos (a mano y además por GTM). Contar coincidencias en
//      vez de cargas produciría un crítico falso en casi todas las webs.
//
//   4. LO QUE NO SE PUEDE VER. Leyendo el HTML solo se ve lo que manda el
//      servidor. Un evento atado a un clic no existe hasta que alguien hace
//      clic. El informe NUNCA dice «no hay evento X»: dice «no lo encontramos
//      en estas URLs». Esa distinción es el producto.
//
// Sobre los códigos de error: un 5xx aquí no llega al navegador — Traefik lo
// sustituye por su propia página de error y el usuario ve un mensaje ajeno. Y
// además sería mentira: si la web auditada no responde, quien ha fallado no es
// esta API. Todo lo que el usuario debe leer sale como 4xx.

import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'

// Variable con nombre propio y no PORT: un PORT suelto en el entorno de la
// máquina de desarrollo se lleva el puerto sin avisar y sin un solo error.
const PUERTO = Number(process.env.SENAL_PUERTO || 3011)
const LIMITE_HORA = Number(process.env.SENAL_LIMITE_HORA || 5)

const LIMITE_CUERPO = 3 * 1024 * 1024 // el HTML de una tienda grande abulta
const LIMITE_CONTENEDOR = 6 * 1024 * 1024 // gtm.js de un contenedor cargado
const TIEMPO_MAXIMO = 12_000
const SALTOS_MAXIMOS = 4
const MAX_URLS = 3

// ─────────────────────────────  destino permitido  ─────────────────────────

function ipv4Privada(ip) {
  const o = ip.split('.').map(Number)
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  if (o[0] === 0 || o[0] === 10 || o[0] === 127) return true
  if (o[0] === 169 && o[1] === 254) return true // link-local / metadatos cloud
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true // docker vive aquí
  if (o[0] === 192 && o[1] === 168) return true
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true // CGNAT
  if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true
  if (o[0] === 198 && (o[1] === 18 || o[1] === 19)) return true
  if (o[0] >= 224) return true // multicast y reservados
  return false
}

function esPublica(ip) {
  const v = net.isIP(ip)
  if (v === 4) return !ipv4Privada(ip)
  if (v === 6) {
    const b = ip.toLowerCase()
    // ::ffff:1.2.3.4 es IPv4 disfrazada; se juzga como IPv4.
    const mapeada = b.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapeada) return !ipv4Privada(mapeada[1])
    return /^[23]/.test(b) // solo unicast global (2000::/3)
  }
  return false
}

// Se le pasa a http.request como `lookup`: node se conecta EXACTAMENTE a la
// dirección que devolvemos, así que no hay ventana para un cambio de DNS entre
// la comprobación y la conexión.
function lookupSeguro(nombre, opciones, callback) {
  dns.lookup(nombre, { all: true, verbatim: true }, (err, direcciones) => {
    if (err) return callback(err)
    const buenas = direcciones.filter((d) => esPublica(d.address))
    if (!buenas.length) {
      return callback(Object.assign(new Error('destino no permitido'), { code: 'DESTINO_PRIVADO' }))
    }
    if (opciones && opciones.all) return callback(null, buenas)
    callback(null, buenas[0].address, buenas[0].family)
  })
}

// ─────────────────────────────  descarga  ──────────────────────────────────

const UA_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function pedirUna(url, { limite = LIMITE_CUERPO, tiempo = TIEMPO_MAXIMO } = {}) {
  return new Promise((resolve, reject) => {
    let objetivo
    try {
      objetivo = new URL(url)
    } catch {
      return reject(Object.assign(new Error('url inválida'), { code: 'URL' }))
    }
    if (objetivo.protocol !== 'http:' && objetivo.protocol !== 'https:') {
      return reject(Object.assign(new Error('solo http y https'), { code: 'ESQUEMA' }))
    }
    // OJO: si el host YA es una IP literal, node se conecta sin pasar por
    // `lookup` y el guardián de arriba nunca se ejecutaría. Hay que juzgarla
    // aquí. Sin esto, http://127.0.0.1:5432 entra tan tranquilo.
    const soloIp = objetivo.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(soloIp) && !esPublica(soloIp)) {
      return reject(Object.assign(new Error('destino no permitido'), { code: 'DESTINO_PRIVADO' }))
    }

    const cliente = objetivo.protocol === 'https:' ? https : http
    let acabado = false
    const peticion = cliente.request(
      objetivo,
      {
        method: 'GET',
        lookup: lookupSeguro,
        timeout: tiempo,
        headers: {
          'user-agent': UA_NAVEGADOR,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
          'accept-encoding': 'identity',
        },
      },
      (res) => {
        // Pedimos `identity`, pero muchos CDN comprimen igual. Sin deshacerlo,
        // el cuerpo llega en binario, no casa ni un patrón y la página se
        // rechaza con «no devuelve una página web» estando perfecta. Lo
        // encontró una tienda real detrás de CDN, no la lectura del código.
        const codificacion = String(res.headers['content-encoding'] || '').toLowerCase()
        let flujo = res
        if (codificacion === 'gzip' || codificacion === 'deflate') {
          flujo = res.pipe(zlib.createUnzip())
        } else if (codificacion === 'br') {
          flujo = res.pipe(zlib.createBrotliDecompress())
        }
        // Un cuerpo mal comprimido no debe tumbar la auditoría entera: se
        // resuelve con lo que se llevara leído.
        if (flujo !== res) flujo.on('error', () => terminar())

        const trozos = []
        let total = 0
        let cortado = false
        const terminar = () => {
          if (acabado) return
          acabado = true
          resolve({
            estado: res.statusCode,
            cabeceras: res.headers,
            cuerpo: Buffer.concat(trozos).toString('utf8'),
            bytes: total,
            cortado,
            url: objetivo.href,
          })
        }
        flujo.on('data', (t) => {
          total += t.length
          if (total > limite) {
            cortado = true
            res.destroy()
            return
          }
          trozos.push(t)
        })
        flujo.on('end', terminar)
        res.on('close', terminar)
      },
    )
    peticion.on('timeout', () => peticion.destroy(Object.assign(new Error('tardó demasiado'), { code: 'TIEMPO' })))
    peticion.on('error', (e) => {
      if (!acabado) reject(e)
    })
    peticion.end()
  })
}

// Sigue las redirecciones a mano para revalidar cada salto: si la primera
// respuesta es un 302 hacia una IP interna, el guardián tiene que verlo.
async function descargar(url, opciones = {}) {
  let actual = url
  for (let i = 0; i <= SALTOS_MAXIMOS; i++) {
    const r = await pedirUna(actual, opciones)
    if ([301, 302, 303, 307, 308].includes(r.estado) && r.cabeceras.location) {
      actual = new URL(r.cabeceras.location, actual).href
      continue
    }
    return { ...r, urlFinal: actual }
  }
  throw Object.assign(new Error('demasiadas redirecciones'), { code: 'SALTOS' })
}

// ─────────────────────────  catálogo de plataformas  ────────────────────────

const PLATAFORMAS = {
  meta: { nombre: 'Meta', panel: 'Administrador de eventos de Meta' },
  google: { nombre: 'Google', panel: 'GA4 y Google Ads' },
  tiktok: { nombre: 'TikTok', panel: 'TikTok Events Manager' },
  linkedin: { nombre: 'LinkedIn', panel: 'Campaign Manager de LinkedIn' },
}

// Eventos que la plataforma reconoce y con los que SÍ puede optimizar. Uno
// fuera de esta lista se registra igual, pero el algoritmo no lo entiende.
const ESTANDAR = {
  meta: [
    'PageView', 'ViewContent', 'Search', 'AddToCart', 'AddToWishlist', 'InitiateCheckout',
    'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact', 'CustomizeProduct',
    'Donate', 'FindLocation', 'Schedule', 'StartTrial', 'SubmitApplication', 'Subscribe',
  ],
  tiktok: [
    'Pageview', 'PageView', 'ViewContent', 'ClickButton', 'Search', 'AddToWishlist', 'AddToCart',
    'InitiateCheckout', 'AddPaymentInfo', 'CompletePayment', 'PlaceAnOrder', 'Contact', 'Download',
    'SubmitForm', 'CompleteRegistration', 'Subscribe',
  ],
  google: [
    'page_view', 'view_item', 'view_item_list', 'select_item', 'add_to_cart', 'remove_from_cart',
    'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'refund',
    'generate_lead', 'sign_up', 'login', 'search', 'share', 'select_promotion', 'view_promotion',
    'add_to_wishlist', 'conversion',
  ],
  linkedin: [],
}

// Ruido de GTM que no es un evento del negocio: son señales internas del
// propio contenedor. Colarlas en la matriz sería inflar la cobertura.
const EVENTOS_IGNORADOS = new Set([
  'gtm.js', 'gtm.dom', 'gtm.load', 'gtm.click', 'gtm.linkClick', 'gtm.formSubmit', 'gtm.scrollDepth',
  'gtm.historyChange', 'gtm.historyChange-v2', 'gtm.timer', 'gtm.elementVisibility', 'gtm.video',
  'gtm.triggerGroup', 'gtm.init', 'gtm.init_consent', 'gtm.config', 'gtm.event',
])

// El embudo canónico por tipo de negocio, y cómo se llama cada peldaño en cada
// plataforma. Es lo que hace legible la matriz: sin esto, comparar `Purchase`
// con `purchase` con `CompletePayment` lo tiene que hacer el lector a mano.
const EMBUDOS = {
  ecommerce: {
    nombre: 'Tienda online',
    etapas: [
      { clave: 'visita', nombre: 'Visita', clave_corta: 'Visita', meta: ['PageView'], google: ['page_view'], tiktok: ['Pageview', 'PageView'], obligatoria: false },
      { clave: 'producto', nombre: 'Ver producto', clave_corta: 'Producto', meta: ['ViewContent'], google: ['view_item'], tiktok: ['ViewContent'], obligatoria: true },
      { clave: 'carrito', nombre: 'Añadir al carrito', clave_corta: 'Carrito', meta: ['AddToCart'], google: ['add_to_cart'], tiktok: ['AddToCart'], obligatoria: true },
      { clave: 'pago', nombre: 'Iniciar pago', clave_corta: 'Pago', meta: ['InitiateCheckout'], google: ['begin_checkout'], tiktok: ['InitiateCheckout'], obligatoria: true },
      { clave: 'compra', nombre: 'Compra', clave_corta: 'Compra', meta: ['Purchase'], google: ['purchase'], tiktok: ['CompletePayment', 'PlaceAnOrder'], obligatoria: true, conversion: true },
    ],
  },
  leads: {
    nombre: 'Generación de leads',
    etapas: [
      { clave: 'visita', nombre: 'Visita', clave_corta: 'Visita', meta: ['PageView'], google: ['page_view'], tiktok: ['Pageview', 'PageView'], obligatoria: false },
      { clave: 'interes', nombre: 'Ver servicio', clave_corta: 'Servicio', meta: ['ViewContent'], google: ['view_item', 'view_item_list'], tiktok: ['ViewContent'], obligatoria: true },
      { clave: 'contacto', nombre: 'Contacto iniciado', clave_corta: 'Contacto', meta: ['Contact', 'Schedule'], google: ['select_item', 'share'], tiktok: ['Contact', 'ClickButton'], obligatoria: false },
      { clave: 'lead', nombre: 'Lead enviado', clave_corta: 'Lead', meta: ['Lead', 'CompleteRegistration', 'SubmitApplication'], google: ['generate_lead', 'sign_up'], tiktok: ['SubmitForm', 'CompleteRegistration'], obligatoria: true, conversion: true },
    ],
  },
  reservas: {
    nombre: 'Reservas y citas',
    etapas: [
      { clave: 'visita', nombre: 'Visita', clave_corta: 'Visita', meta: ['PageView'], google: ['page_view'], tiktok: ['Pageview', 'PageView'], obligatoria: false },
      { clave: 'disponibilidad', nombre: 'Ver disponibilidad', clave_corta: 'Disponibilidad', meta: ['ViewContent', 'Search'], google: ['view_item', 'search'], tiktok: ['ViewContent', 'Search'], obligatoria: true },
      { clave: 'inicio', nombre: 'Iniciar reserva', clave_corta: 'Iniciar', meta: ['InitiateCheckout', 'Schedule'], google: ['begin_checkout'], tiktok: ['InitiateCheckout'], obligatoria: true },
      { clave: 'reserva', nombre: 'Reserva confirmada', clave_corta: 'Reserva', meta: ['Purchase', 'Schedule'], google: ['purchase', 'generate_lead'], tiktok: ['CompletePayment', 'PlaceAnOrder', 'SubmitForm'], obligatoria: true, conversion: true },
    ],
  },
}

// ─────────────────────────────  detectores  ─────────────────────────────────
//
// Cada detector dice: qué plataforma, qué tipo de identificador y si es una
// CARGA (inicia el píxel: cuenta para el diagnóstico de duplicados) o solo una
// HUELLA (lo confirma, pero no lo inicia otra vez). Confundir las dos es lo que
// haría saltar un crítico falso en cualquier web con `<noscript>`.

const IDENTIFICADORES = [
  // ── Meta ────────────────────────────────────────────────────────────────
  { plataforma: 'meta', tipo: 'pixel', carga: true, via: 'fbq(\'init\')', re: /fbq\s*\(\s*(['"])init\1\s*,\s*(['"])(\d{6,20})\2/g, grupo: 3 },
  { plataforma: 'meta', tipo: 'pixel', carga: true, via: 'etiqueta de GTM', re: /vtp_pixelId["']?\s*[:=]\s*["'](\d{6,20})["']/g, grupo: 1, soloGtm: true },
  { plataforma: 'meta', tipo: 'pixel', carga: false, via: 'imagen <noscript>', re: /facebook\.com\/tr\/?\?[^"'\s<>]*?id=(\d{6,20})/g, grupo: 1 },
  { plataforma: 'meta', tipo: 'pixel', carga: false, via: 'fbq(\'trackSingle\')', re: /fbq\s*\(\s*(['"])trackSingle(?:Custom)?\1\s*,\s*(['"])(\d{6,20})\2/g, grupo: 3 },

  // ── Google ──────────────────────────────────────────────────────────────
  { plataforma: 'google', tipo: 'gtm', carga: true, via: 'contenedor de GTM', re: /googletagmanager\.com\/gtm\.js\?[^"'\s<>]*?id=(GTM-[A-Z0-9]{4,12})/gi, grupo: 1 },
  { plataforma: 'google', tipo: 'gtm', carga: false, via: 'referencia a GTM', re: /["'](GTM-[A-Z0-9]{4,12})["']/g, grupo: 1 },
  { plataforma: 'google', tipo: 'ga4', carga: true, via: 'gtag(\'config\')', re: /gtag\s*\(\s*(['"])config\1\s*,\s*(['"])(G-[A-Z0-9]{6,14})\2/g, grupo: 3 },
  { plataforma: 'google', tipo: 'ga4', carga: true, via: 'etiqueta de GTM', re: /vtp_measurementId(?:Override)?["']?\s*[:=]\s*["'](G-[A-Z0-9]{6,14})["']/g, grupo: 1, soloGtm: true },
  { plataforma: 'google', tipo: 'ga4', carga: false, via: 'cargador gtag.js', re: /googletagmanager\.com\/gtag\/js\?[^"'\s<>]*?id=(G-[A-Z0-9]{6,14})/gi, grupo: 1 },
  { plataforma: 'google', tipo: 'ga4', carga: false, via: 'referencia', re: /["'/=](G-[A-Z0-9]{6,14})\b/g, grupo: 1 },
  { plataforma: 'google', tipo: 'ads', carga: true, via: 'gtag(\'config\')', re: /gtag\s*\(\s*(['"])config\1\s*,\s*(['"])(AW-\d{8,14})\2/g, grupo: 3 },
  { plataforma: 'google', tipo: 'ads', carga: false, via: 'referencia', re: /["'/=](AW-\d{8,14})\b/g, grupo: 1 },
  { plataforma: 'google', tipo: 'ua', carga: false, via: 'Universal Analytics', re: /["'/=](UA-\d{4,12}-\d{1,4})\b/g, grupo: 1 },

  // ── TikTok ──────────────────────────────────────────────────────────────
  { plataforma: 'tiktok', tipo: 'pixel', carga: true, via: 'ttq.load()', re: /ttq\.load\s*\(\s*(['"])([A-Z0-9]{8,32})\1/gi, grupo: 2 },
  { plataforma: 'tiktok', tipo: 'pixel', carga: true, via: 'etiqueta de GTM', re: /vtp_pixelCode["']?\s*[:=]\s*["']([A-Z0-9]{8,32})["']/gi, grupo: 1, soloGtm: true },
  { plataforma: 'tiktok', tipo: 'pixel', carga: false, via: 'cargador events.js', re: /analytics\.tiktok\.com\/[^"'\s<>]*?sdkid=([A-Z0-9]{8,32})/gi, grupo: 1 },

  // ── LinkedIn ────────────────────────────────────────────────────────────
  { plataforma: 'linkedin', tipo: 'insight', carga: true, via: '_linkedin_partner_id', re: /_linkedin_partner_id\s*=\s*["'](\d{4,12})["']/g, grupo: 1 },
  { plataforma: 'linkedin', tipo: 'insight', carga: true, via: 'etiqueta de GTM', re: /vtp_partnerId["']?\s*[:=]\s*["'](\d{4,12})["']/g, grupo: 1, soloGtm: true },
  { plataforma: 'linkedin', tipo: 'insight', carga: false, via: 'píxel de respaldo', re: /px\.ads\.linkedin\.com\/collect\/?\?[^"'\s<>]*?pid=(\d{4,12})/g, grupo: 1 },
]

const DETECTORES_EVENTO = [
  { plataforma: 'meta', re: /fbq\s*\(\s*(['"])track\1\s*,\s*(['"])([A-Za-z0-9_. -]{2,60})\2/g, grupo: 3 },
  { plataforma: 'meta', re: /fbq\s*\(\s*(['"])trackCustom\1\s*,\s*(['"])([A-Za-z0-9_. -]{2,60})\2/g, grupo: 3 },
  { plataforma: 'meta', re: /fbq\s*\(\s*(['"])trackSingle(?:Custom)?\1\s*,\s*(['"])\d{6,20}\2\s*,\s*(['"])([A-Za-z0-9_. -]{2,60})\3/g, grupo: 4 },
  { plataforma: 'tiktok', re: /ttq\s*(?:\.instance\s*\([^)]*\))?\.track\s*\(\s*(['"])([A-Za-z0-9_. -]{2,60})\1/g, grupo: 2 },
  { plataforma: 'google', re: /gtag\s*\(\s*(['"])event\1\s*,\s*(['"])([A-Za-z0-9_.-]{2,60})\2/g, grupo: 3 },
  { plataforma: 'google', re: /vtp_eventName["']?\s*[:=]\s*["']([A-Za-z0-9_.-]{2,60})["']/g, grupo: 1, soloGtm: true },
]

// LinkedIn no nombra sus conversiones: son un número de Campaign Manager.
const RE_LINTRK = /lintrk\s*\(\s*(['"])track\1\s*,\s*\{[^}]*?conversion_id\s*:\s*(\d{3,12})/g

// `ttq.page()` no lleva nombre: es la vista de página de TikTok.
const RE_TTQ_PAGE = /ttq\s*(?:\.instance\s*\([^)]*\))?\.page\s*\(/
// dataLayer.push({event:'purchase'}) es como se declara casi todo el ecommerce
// de GA4. Solo se mira dentro de bloques que hablan de dataLayer, porque
// `"event":` a secas aparece en mil sitios que no son medición.
const RE_DATALAYER = /dataLayer/
const RE_EVENTO_SUELTO = /["']event["']\s*:\s*["']([A-Za-z0-9_.\- ]{2,60})["']/g
// Meta manda el mismo evento por navegador y por servidor con un `eventID`
// común para no contarlo dos veces. Ver ese campo es el único indicio fiable
// de Conversions API que deja el HTML.
const RE_EVENT_ID = /fbq\s*\([^;]{0,400}?event(?:ID|_id)\s*[:=]/

function coincidencias(texto, re, grupo) {
  const salida = []
  re.lastIndex = 0
  let m
  while ((m = re.exec(texto)) !== null) {
    if (m[grupo]) salida.push({ valor: m[grupo], indice: m.index })
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return salida
}

// gtm.js guarda el HTML personalizado como cadena escapada: los saltos de
// línea llegan como los dos caracteres \ y n, y los `<` como <. Sin
// deshacer eso, un `fbq(\n'init'` no casa con ningún patrón y el píxel pegado
// a mano dentro de GTM pasaría inadvertido — justo el hallazgo que buscamos.
function normalizarContenedor(js) {
  return js
    .replace(/\\u003[cC]/g, '<')
    .replace(/\\u003[eE]/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\(["'/])/g, '$1')
}

// Extrae identificadores y eventos de un trozo de código, sea el HTML de una
// página o el JavaScript de un contenedor de GTM.
function leerCodigo(texto, { esGtm = false } = {}) {
  const senales = []
  const eventos = []

  for (const d of IDENTIFICADORES) {
    if (d.soloGtm && !esGtm) continue
    // Un `GTM-XXXX` suelto solo se cree si la página habla de googletagmanager;
    // si no, cualquier cadena con ese aspecto se contaría como contenedor.
    if (d.tipo === 'gtm' && !d.carga && !/googletagmanager/i.test(texto)) continue
    for (const c of coincidencias(texto, d.re, d.grupo)) {
      const id = d.plataforma === 'google' ? c.valor.toUpperCase() : c.valor
      // Los IDs de TikTok son alfanuméricos en mayúsculas; normalizarlos evita
      // contar dos veces el mismo píxel escrito con distinta caja.
      const idFinal = d.plataforma === 'tiktok' ? id.toUpperCase() : id
      senales.push({ plataforma: d.plataforma, tipo: d.tipo, id: idFinal, carga: d.carga, via: d.via })
    }
  }

  for (const d of DETECTORES_EVENTO) {
    if (d.soloGtm && !esGtm) continue
    for (const c of coincidencias(texto, d.re, d.grupo)) {
      eventos.push({ plataforma: d.plataforma, nombre: c.valor.trim() })
    }
  }

  if (RE_TTQ_PAGE.test(texto)) eventos.push({ plataforma: 'tiktok', nombre: 'Pageview' })
  for (const c of coincidencias(texto, RE_LINTRK, 2)) {
    eventos.push({ plataforma: 'linkedin', nombre: `Conversión ${c.valor}` })
  }

  if (RE_DATALAYER.test(texto)) {
    for (const c of coincidencias(texto, RE_EVENTO_SUELTO, 1)) {
      eventos.push({ plataforma: 'google', nombre: c.valor.trim() })
    }
  }

  const capi = RE_EVENT_ID.test(texto)

  return { senales, eventos: eventos.filter((e) => !EVENTOS_IGNORADOS.has(e.nombre)), capi }
}

// ────────────────────────  contenedores de GTM  ─────────────────────────────

const RE_FUNCION_ETIQUETA = /"function"\s*:\s*"(__[a-zA-Z0-9_]+)"/g

const FAMILIAS_ETIQUETA = {
  __gaawe: 'Evento de GA4',
  __ga4: 'Evento de GA4',
  __googtag: 'Etiqueta de Google',
  __gtag: 'Etiqueta de Google',
  __awct: 'Conversión de Google Ads',
  __sp: 'Remarketing de Google Ads',
  __gclidw: 'Enlace de conversiones de Google',
  __ua: 'Universal Analytics (obsoleto)',
  __html: 'HTML personalizado',
  __img: 'Píxel de imagen',
  __flc: 'Floodlight',
}

// Leer el contenedor entero de una vez atribuye mal: el `vtp_eventName` de una
// etiqueta de Meta se contaba como evento de Google, porque el nombre del campo
// es el mismo en las dos plantillas. Hay que trocear por etiqueta y preguntar
// de quién es cada una ANTES de leer lo que declara.
const CAMPOS_ETIQUETA = [
  { plataforma: 'meta', tipo: 'pixel', re: /vtp_pixelId["']?\s*[:=]\s*["'](\d{6,20})["']/, via: 'etiqueta de GTM' },
  { plataforma: 'tiktok', tipo: 'pixel', re: /vtp_pixelCode["']?\s*[:=]\s*["']([A-Za-z0-9]{8,32})["']/, via: 'etiqueta de GTM' },
  { plataforma: 'linkedin', tipo: 'insight', re: /vtp_partnerId["']?\s*[:=]\s*["'](\d{4,12})["']/, via: 'etiqueta de GTM' },
  { plataforma: 'google', tipo: 'ga4', re: /vtp_(?:measurementId(?:Override)?|tagId)["']?\s*[:=]\s*["'](G-[A-Z0-9]{6,14})["']/, via: 'etiqueta de GTM' },
  { plataforma: 'google', tipo: 'ads', re: /vtp_conversionId["']?\s*[:=]\s*["']?(\d{8,14})["']?/, via: 'conversión de Google Ads', prefijo: 'AW-' },
  { plataforma: 'google', tipo: 'ua', re: /vtp_trackingId["']?\s*[:=]\s*["'](UA-\d{4,12}-\d{1,4})["']/, via: 'etiqueta de GTM' },
]

const RE_NOMBRE_EVENTO = /vtp_eventName["']?\s*[:=]\s*["']([A-Za-z0-9_.\- ]{2,60})["']/
const RE_EVENTO_ESTANDAR = /vtp_standardEventName["']?\s*[:=]\s*["']([A-Za-z0-9_.\- ]{2,60})["']/
const RE_EVENTO_PERSONALIZADO = /vtp_customEventName["']?\s*[:=]\s*["']([A-Za-z0-9_.\- ]{2,60})["']/

// ⚠️ En la plantilla oficial de Meta, `vtp_eventName` NO es el nombre del
// evento: es el SELECTOR DEL TIPO, y vale «standard» o «custom». El nombre de
// verdad vive en `vtp_standardEventName` o en `vtp_customEventName`:
//
//   "vtp_pixelId":"1246...","vtp_standardEventName":"PageView",
//   "vtp_eventName":"standard"
//
// Leyendo el campo por su nombre, el informe declaraba que la tienda usa dos
// eventos personalizados llamados «standard» y «custom» —que no existen— y se
// perdía los reales. Es el mismo vicio que un rótulo metido dentro del valor:
// el campo se llama igual en dos plantillas y significa cosas distintas.
const SELECTORES_DE_TIPO = new Set(['standard', 'custom'])

function nombreDeEvento(cuerpo) {
  const selector = (cuerpo.match(RE_NOMBRE_EVENTO) || [])[1]
  const tipo = selector && selector.trim().toLowerCase()
  if (tipo === 'standard') return (cuerpo.match(RE_EVENTO_ESTANDAR) || [])[1]
  if (tipo === 'custom') return (cuerpo.match(RE_EVENTO_PERSONALIZADO) || [])[1]
  // Sin selector, el campo específico manda si existe; si no, el genérico,
  // que es lo que usan las etiquetas de GA4.
  return (cuerpo.match(RE_EVENTO_ESTANDAR) || [])[1] || (cuerpo.match(RE_EVENTO_PERSONALIZADO) || [])[1] || (SELECTORES_DE_TIPO.has(tipo) ? undefined : selector)
}

// En un contenedor real el ID de GA4 casi nunca es un literal: la etiqueta lo
// toma de una variable. Si la plataforma se dedujera del ID, todos los eventos
// de GA4 de cualquier web bien montada se perderían. El NOMBRE DE LA FUNCIÓN
// de la etiqueta sí es literal siempre, y ya dice de quién es.
const PLATAFORMA_POR_FUNCION = {
  __gaawe: 'google', __ga4: 'google', __googtag: 'google', __gtag: 'google',
  __awct: 'google', __sp: 'google', __ua: 'google', __gclidw: 'google',
}

function leerCodigoContenedor(js) {
  const senales = []
  const eventos = []
  let capi = false
  // Etiquetas que declaran un evento pero toman su nombre de una variable del
  // contenedor. Se sabe que existen y no se sabe qué disparan. Callarlo sería
  // decir «no hay evento» cuando lo correcto es «no podemos leerlo».
  let opacas = 0
  const trozos = js.split('{"function":"')
  for (let indice = 1; indice < trozos.length; indice++) {
    const bruto = trozos[indice]
    const fin = bruto.indexOf('"')
    const fn = fin > 0 ? bruto.slice(0, fin) : ''
    // Una etiqueta rara vez pasa de unos pocos kB; cortar evita que el trozo
    // de la última se coma el resto del archivo.
    const cuerpo = normalizarContenedor(bruto.slice(0, 20000))

    // El HTML personalizado es una página dentro del contenedor: se lee igual.
    if (fn === '__html' || fn === '__img' || fn === '__cl' || fn === '__remm') {
      const r = leerCodigo(cuerpo)
      // La etiqueta que lo declara viaja con la señal. Sin ella, dos
      // `fbq('init')` en dos etiquetas distintas del mismo contenedor —que es
      // el duplicado que de verdad se ve en las webs que meten todo por GTM—
      // se colapsarían en una sola carga y no se detectaría nunca.
      senales.push(...r.senales.map((x) => ({ ...x, etiqueta: indice })))
      eventos.push(...r.eventos)
      capi = capi || r.capi
      continue
    }

    const duenos = []
    for (const c of CAMPOS_ETIQUETA) {
      const m = cuerpo.match(c.re)
      if (!m) continue
      const id = (c.prefijo || '') + m[1]
      duenos.push({ plataforma: c.plataforma, tipo: c.tipo, id, via: c.via })
      senales.push({ plataforma: c.plataforma, tipo: c.tipo, id, carga: true, via: c.via })
    }
    const nombre = nombreDeEvento(cuerpo)
    const dePlantilla = duenos.find((d) => d.tipo !== 'ua' && d.tipo !== 'ads')
    const plataforma = PLATAFORMA_POR_FUNCION[fn] || (dePlantilla && dePlantilla.plataforma)
    if (nombre && plataforma) {
      const limpio = nombre.trim()
      if (!EVENTOS_IGNORADOS.has(limpio)) eventos.push({ plataforma, nombre: limpio })
    } else if (!nombre && /vtp_(?:standard|custom)?[eE]ventName/.test(cuerpo)) {
      opacas++
    }
  }
  return { senales, eventos, capi, opacas }
}

function resumirContenedor(js) {
  const cuenta = new Map()
  for (const c of coincidencias(js, RE_FUNCION_ETIQUETA, 1)) {
    const clave = c.valor.startsWith('__cvt_') ? '__cvt' : c.valor
    cuenta.set(clave, (cuenta.get(clave) || 0) + 1)
  }
  const total = [...cuenta.values()].reduce((s, n) => s + n, 0)
  // Se agrupa por el nombre que ve el usuario. Agrupar por la clave interna
  // llenaba la lista de treinta entradas iguales llamadas «Otra etiqueta».
  const porNombre = new Map()
  for (const [clave, n] of cuenta) {
    const nombre = clave === '__cvt' ? 'Plantilla de la galería' : FAMILIAS_ETIQUETA[clave] || 'Otras etiquetas'
    porNombre.set(nombre, (porNombre.get(nombre) || 0) + n)
  }
  const etiquetas = [...porNombre.entries()]
    .map(([nombre, n]) => ({ clave: nombre, nombre, n }))
    .sort((a, b) => b.n - a.n)
  return { etiquetas, total }
}

async function leerContenedor(idGtm, traer = descargar) {
  const url = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(idGtm)}`
  try {
    const r = await traer(url, { limite: LIMITE_CONTENEDOR })
    if (r.estado !== 200 || r.bytes < 2000) {
      return { id: idGtm, ok: false, motivo: 'El contenedor no está publicado o no es público.' }
    }
    const { senales, eventos, capi, opacas } = leerCodigoContenedor(r.cuerpo)
    const { etiquetas, total } = resumirContenedor(r.cuerpo)
    return { id: idGtm, ok: true, bytes: r.bytes, etiquetas, total, opacas, senales, eventos, capi }
  } catch (e) {
    return { id: idGtm, ok: false, motivo: 'No pudimos descargar el contenedor.', codigo: e.code || '' }
  }
}

// ────────────────────────────  la auditoría  ────────────────────────────────

const ETIQUETAS_PAGINA = ['Portada', 'Producto o servicio', 'Gracias o confirmación']

function esHtml(cabeceras, cuerpo) {
  const tipo = String(cabeceras['content-type'] || '')
  if (tipo && !/html|xml|text\/plain/i.test(tipo)) return false
  return /<html|<!doctype|<body|<script/i.test(cuerpo.slice(0, 4000))
}

function claveInstalacion(s) {
  return `${s.plataforma}|${s.tipo}|${s.id}`
}

// `traer` se inyecta a proposito: el informe de ejemplo de la app lo sustituye
// por un lector de ficheros y asi pasa por ESTE motor, no por una copia. Un
// ejemplo que se saltara las reglas que la app promete la desmentiria entera.
async function auditar(entradas, negocio, traer = descargar) {
  const paginas = []
  const senales = [] // cada señal con su página y su origen
  const eventos = []
  let indiciosCapi = false

  // La etiqueta va con la URL, no con su posición en la lista: quien rellene
  // la portada y la página de gracias saltándose la del medio vería su URL de
  // gracias descrita como «Producto o servicio». Una etiqueta de procedencia
  // equivocada desmiente el informe entero.
  const lista = entradas.map((e, i) =>
    typeof e === 'string' ? { url: e, etiqueta: ETIQUETAS_PAGINA[i] || `Página ${i + 1}` } : e,
  )

  for (let i = 0; i < lista.length; i++) {
    const { url, etiqueta } = lista[i]
    try {
      const r = await traer(url)
      if (r.estado >= 400) {
        paginas.push({ url, etiqueta, ok: false, motivo: `La página respondió con un error ${r.estado}.` })
        continue
      }
      if (!esHtml(r.cabeceras, r.cuerpo)) {
        paginas.push({ url, etiqueta, ok: false, motivo: 'Esa dirección no devuelve una página web.' })
        continue
      }
      const lectura = leerCodigo(r.cuerpo)
      if (lectura.capi) indiciosCapi = true
      for (const s of lectura.senales) senales.push({ ...s, pagina: i, origen: 'html' })
      for (const e of lectura.eventos) eventos.push({ ...e, pagina: i, origen: 'html' })
      paginas.push({
        url,
        urlFinal: r.urlFinal !== url ? r.urlFinal : undefined,
        etiqueta,
        ok: true,
        bytes: r.bytes,
        cortada: r.cortado,
      })
    } catch (e) {
      paginas.push({ url, etiqueta, ok: false, motivo: mensajeDeError(e) })
    }
  }

  // Contenedores de GTM: uno por ID distinto, aunque aparezca en las tres URLs.
  const idsGtm = [...new Set(senales.filter((s) => s.tipo === 'gtm').map((s) => s.id))].slice(0, 3)
  const contenedores = []
  for (const id of idsGtm) {
    const c = await leerContenedor(id, traer)
    contenedores.push({ id: c.id, ok: c.ok, motivo: c.motivo, bytes: c.bytes, etiquetas: c.etiquetas, total: c.total, opacas: c.opacas })
    if (!c.ok) continue
    if (c.capi) indiciosCapi = true
    // Las páginas donde vive este contenedor: lo que hay dentro se carga en
    // todas ellas, y ahí es donde puede chocar con lo pegado a mano.
    const donde = [...new Set(senales.filter((s) => s.tipo === 'gtm' && s.id === id).map((s) => s.pagina))]
    for (const p of donde) {
      for (const s of c.senales) {
        if (s.tipo === 'gtm') continue // un contenedor citándose a sí mismo
        senales.push({ ...s, pagina: p, origen: 'gtm', contenedor: id })
      }
    }
    // Los eventos del contenedor NO se atribuyen a ninguna página: cada
    // etiqueta tiene su disparador y no se dispara en todas. Decir que
    // «purchase salta en la portada» porque el contenedor está en la portada
    // sería inventarse el dato que la app promete no inventar.
    for (const e of c.eventos) eventos.push({ ...e, pagina: null, origen: 'gtm', contenedor: id })
  }

  return armarInforme({ paginas, senales, eventos, contenedores, negocio, indiciosCapi })
}

// ───────────────────────────  diagnóstico  ──────────────────────────────────

function armarInforme({ paginas, senales, eventos, contenedores, negocio, indiciosCapi }) {
  const leidas = paginas.filter((p) => p.ok)
  const embudo = EMBUDOS[negocio] || EMBUDOS.ecommerce

  // ── Instalaciones: una por (plataforma, tipo, id), con dónde se vio ──────
  const mapa = new Map()
  for (const s of senales) {
    const k = claveInstalacion(s)
    if (!mapa.has(k)) {
      mapa.set(k, { plataforma: s.plataforma, tipo: s.tipo, id: s.id, paginas: new Set(), vias: new Set(), cargas: [] })
    }
    const inst = mapa.get(k)
    inst.paginas.add(s.pagina)
    inst.vias.add(s.via)
    if (s.carga) {
      // `etiqueta` es la etiqueta de GTM que la declara, y tiene que llegar
      // hasta aquí: es lo que distingue dos inicios en dos etiquetas de un
      // solo campo repetido por la plantilla.
      inst.cargas.push({ pagina: s.pagina, origen: s.origen, contenedor: s.contenedor, via: s.via, etiqueta: s.etiqueta })
    }
  }

  const instalaciones = [...mapa.values()].map((i) => {
    // Fuentes de carga POR PÁGINA. Dos `fbq('init')` idénticos en el mismo HTML
    // son dos cargas; el mismo ID en el HTML y en GTM, también. El `<noscript>`
    // no cuenta: no inicia nada, solo confirma.
    const porPagina = new Map()
    for (const c of i.cargas) {
      const lista = porPagina.get(c.pagina) || []
      lista.push(c)
      porPagina.set(c.pagina, lista)
    }
    let duplicada = null
    for (const [pagina, cargas] of porPagina) {
      // UN contenedor es UNA carga, aunque dentro tenga diez etiquetas que
      // nombren el mismo ID: la plantilla de Meta repite `pixelId` en cada
      // etiqueta suya. Contar coincidencias aquí marcaría como duplicada
      // cualquier cuenta bien montada, que es el peor error posible en un
      // informe cuyo titular es justo ese diagnóstico.
      const enHtml = cargas.filter((c) => c.origen !== 'gtm').length
      const fuentes = []
      if (enHtml === 1) fuentes.push('el código de la página')
      if (enHtml > 1) fuentes.push(`el código de la página (${enHtml} veces)`)

      let total = enHtml
      const contenedores = [...new Set(cargas.filter((c) => c.origen === 'gtm').map((c) => c.contenedor))]
      for (const cont of contenedores) {
        const suyas = cargas.filter((c) => c.origen === 'gtm' && c.contenedor === cont)
        // Etiquetas de HTML personalizado que inician el píxel, contadas una
        // por etiqueta distinta.
        const sueltas = new Set(suyas.filter((c) => c.etiqueta !== undefined).map((c) => c.etiqueta)).size
        // El campo `pixelId` de una plantilla se repite en TODAS las etiquetas
        // de esa plataforma —una por evento— y no es una carga por cada una.
        // Vale por una sola, y solo si nadie lo inicia ya desde una etiqueta
        // de HTML: la combinación «código base a mano + eventos por plantilla»
        // es el montaje correcto, no un duplicado.
        const porPlantilla = suyas.some((c) => c.etiqueta === undefined) ? 1 : 0
        const cargasDelContenedor = sueltas > 0 ? sueltas : porPlantilla
        total += cargasDelContenedor
        if (cargasDelContenedor > 1) {
          fuentes.push(`${cargasDelContenedor} etiquetas distintas del contenedor ${cont}`)
        } else if (cargasDelContenedor === 1) {
          fuentes.push(`el contenedor ${cont}`)
        }
      }
      if (total < 2) continue
      duplicada = { pagina, fuentes }
      break
    }
    return {
      plataforma: i.plataforma,
      tipo: i.tipo,
      id: i.id,
      paginas: [...i.paginas].sort(),
      vias: [...i.vias],
      duplicada,
    }
  })

  // GA4 envía `page_view` solo con configurar la propiedad: no hace falta
  // declararlo. Sin esta línea la matriz diría que Google no mide la visita,
  // que es falso y hunde la nota de cualquier sitio bien montado.
  for (const inst of instalaciones) {
    if (inst.tipo !== 'ga4') continue
    for (const pag of inst.paginas) {
      eventos.push({ plataforma: 'google', nombre: 'page_view', pagina: pag, origen: 'automatico' })
    }
  }

  // ── Eventos: uno por (plataforma, nombre), con dónde y cómo ─────────────
  const mapaEv = new Map()
  for (const e of eventos) {
    const k = `${e.plataforma}|${e.nombre}`
    if (!mapaEv.has(k)) {
      mapaEv.set(k, { plataforma: e.plataforma, nombre: e.nombre, paginas: new Set(), origenes: new Set() })
    }
    if (e.pagina !== null && e.pagina !== undefined) mapaEv.get(k).paginas.add(e.pagina)
    mapaEv
      .get(k)
      .origenes.add(
        e.origen === 'gtm'
          ? `contenedor ${e.contenedor}`
          : e.origen === 'automatico'
            ? 'automático al configurar GA4'
            : 'código de la página',
      )
  }
  const listaEventos = [...mapaEv.values()]
    .map((e) => ({
      plataforma: e.plataforma,
      nombre: e.nombre,
      estandar: ESTANDAR[e.plataforma].some((n) => n.toLowerCase() === e.nombre.toLowerCase()),
      paginas: [...e.paginas].sort(),
      origenes: [...e.origenes],
    }))
    .sort((a, b) => a.plataforma.localeCompare(b.plataforma) || a.nombre.localeCompare(b.nombre))

  // ── Matriz plataformas × etapas del embudo ──────────────────────────────
  // Una plataforma entra en la matriz si hay señal suya, sea un identificador o
  // un evento. En una web real es normal que el `ttq.load` esté dentro de una
  // variable de GTM y solo se vean sus eventos: dejarla fuera de la matriz por
  // eso escondería justo la plataforma peor medida.
  const activas = [
    ...new Set([
      ...instalaciones.filter((i) => i.tipo !== 'gtm' && i.tipo !== 'ua').map((i) => i.plataforma),
      ...eventos.map((e) => e.plataforma),
    ]),
  ]
  const orden = ['meta', 'google', 'tiktok', 'linkedin']
  const filas = orden
    .filter((p) => activas.includes(p))
    .map((p) => ({
      plataforma: p,
      nombre: PLATAFORMAS[p].nombre,
      celdas: embudo.etapas.map((et) => {
        if (p === 'linkedin') {
          // LinkedIn no nombra sus conversiones: son un número de Campaign
          // Manager. No se puede decir a qué peldaño corresponde cada una.
          const conv = listaEventos.filter((e) => e.plataforma === 'linkedin')
          if (et.conversion && conv.length) {
            return { estado: 'sinnombre', evento: `${conv.length} conversión${conv.length > 1 ? 'es' : ''} sin nombre` }
          }
          return { estado: et.clave === 'visita' ? 'si' : 'nomedible', evento: et.clave === 'visita' ? 'Insight Tag' : '' }
        }
        const esperados = (et[p] || []).map((n) => n.toLowerCase())
        const hallado = listaEventos.find((e) => e.plataforma === p && esperados.includes(e.nombre.toLowerCase()))
        if (hallado) return { estado: 'si', evento: hallado.nombre }
        return { estado: 'no', evento: '' }
      }),
    }))

  // ── Hallazgos ───────────────────────────────────────────────────────────
  const hallazgos = []
  const duplicadas = instalaciones.filter((i) => i.duplicada)

  for (const i of duplicadas) {
    const p = PLATAFORMAS[i.plataforma].nombre
    const donde = paginas[i.duplicada.pagina]
    hallazgos.push({
      id: `duplicado-${i.plataforma}-${i.id}`,
      gravedad: 'critico',
      titulo: `${etiquetaTipo(i.tipo, p)} ${i.id} se carga dos veces`,
      que: `En «${donde ? donde.etiqueta : 'una de las páginas'}» el mismo identificador se inicia desde ${i.duplicada.fuentes.join(' y desde ')}.`,
      porque:
        'Cada visita y cada conversión se cuentan dos veces. El panel enseña el doble de ventas de las que hubo, el coste por conversión sale a la mitad y el algoritmo aprende de datos falsos: acaba comprando el tráfico equivocado con tu presupuesto real.',
      hacer: `Deja una sola carga. Lo habitual es quitar el código pegado a mano en la plantilla del sitio y conservar el que vive en ${i.duplicada.fuentes.find((f) => f.includes('contenedor')) || 'GTM'}, que es donde se puede cambiar sin tocar la web.`,
      detalle: [`Visto en: ${i.vias.join(', ')}`],
    })
  }

  // Plataforma instalada que solo declara vista de página. Se juzga UNA VEZ por
  // plataforma, no por instalación: GA4 y Google Ads son la misma señal para el
  // anunciante, y sacar dos críticos por lo mismo convierte el informe en ruido.
  for (const p of activas) {
    const suyos = listaEventos.filter((e) => e.plataforma === p)
    if (!suyos.length) continue
    if (suyos.some((e) => !esVistaDePagina(p, e.nombre))) continue
    // Una etiqueta de conversión de Google Ads es una señal de conversión
    // aunque no lleve nombre de evento.
    if (p === 'google' && instalaciones.some((i) => i.tipo === 'ads')) continue
    const principal = instalaciones.find((i) => i.plataforma === p && i.tipo !== 'gtm' && i.tipo !== 'ua')
    // Sin un identificador legible no se puede nombrar el píxel, y un hallazgo
    // que no dice de qué píxel habla no sirve para arreglar nada.
    if (!principal) continue
    const conv = embudo.etapas.find((e) => e.conversion)
    hallazgos.push({
      id: `sin-eventos-${p}`,
      gravedad: p === 'linkedin' ? 'aviso' : 'critico',
      titulo: `${etiquetaTipo(principal.tipo, PLATAFORMAS[p].nombre)} ${principal.id} solo registra visitas`,
      que: 'Está instalado y disparando la vista de página, pero no encontramos ni un solo evento de conversión en las URLs que revisamos.',
      porque:
        p === 'linkedin'
          ? 'Sin evento, LinkedIn solo sabe quién pasó por la web, no quién dejó sus datos. Las conversiones se pueden definir también por reglas de URL dentro de Campaign Manager, y eso no se ve desde fuera: conviene comprobarlo ahí antes de dar el aviso por bueno.'
          : `Una campaña configurada para optimizar a conversiones no recibe ninguna señal de qué visita acabó en venta. La plataforma reparte el presupuesto a ciegas y el panel de ${PLATAFORMAS[p].panel} enseña cero conversiones aunque el negocio sí venda.`,
      hacer: `Declara al menos el cierre del embudo (${(conv && conv[p] && conv[p][0]) || 'la conversión'}) en la página de confirmación, con su valor y su moneda.`,
      detalle: [],
    })
  }

  // Cobertura desigual entre plataformas.
  if (filas.length > 1) {
    // Se compara la PROPORCIÓN de lo que cada plataforma puede declarar, no el
    // número bruto: LinkedIn no nombra sus conversiones, así que juzgarla
    // sobre cinco peldaños la condenaría siempre.
    // Se exigen al menos tres peldaños juzgables: con dos, un solo evento
    // mueve el porcentaje 50 puntos y la comparación deja de significar nada.
    const cuenta = filas.map((f) => cuentaFila(f)).filter((c) => c.medibles >= 3)
    if (cuenta.length > 1) {
    const mejor = cuenta.reduce((a, b) => (b.ratio > a.ratio ? b : a))
    const peor = cuenta.reduce((a, b) => (b.ratio < a.ratio ? b : a))
    if (mejor.ratio - peor.ratio >= 0.4) {
      hallazgos.push({
        id: 'cobertura-desigual',
        gravedad: 'aviso',
        titulo: `${peor.nombre} mide mucho menos que ${mejor.nombre}`,
        que: `${mejor.nombre} declara ${mejor.n} de los ${mejor.medibles} peldaños del embudo que puede declarar, y ${peor.nombre} solo ${peor.n} de ${peor.medibles}.`,
        porque:
          'Cada panel cuenta una historia distinta del mismo mes. Al comparar plataformas para decidir dónde poner el presupuesto, la que peor mide siempre parece la que peor funciona, aunque esté vendiendo igual.',
        hacer: `Replica en ${peor.nombre} los mismos eventos que ya tienes en ${mejor.nombre}. Si usas GTM, es duplicar el disparador y cambiar la etiqueta.`,
        detalle: [
        ...cuenta.map((c) => `${c.nombre}: ${c.n} de ${c.medibles}`),
        ...(contenedores.reduce((s, c) => s + (c.opacas || 0), 0)
          ? ['Puede quedarse corto: hay etiquetas en GTM cuyo nombre de evento no se puede leer desde fuera.']
          : []),
      ],
      })
    }
    }
  }

  // Eventos inventados donde debería haber uno estándar.
  const inventados = listaEventos.filter((e) => !e.estandar && (e.plataforma === 'meta' || e.plataforma === 'tiktok'))
  if (inventados.length) {
    hallazgos.push({
      id: 'eventos-inventados',
      gravedad: 'aviso',
      titulo: `${inventados.length} evento${inventados.length > 1 ? 's' : ''} con nombre propio en vez del estándar`,
      que: `Se declaran como eventos personalizados: ${inventados.map((e) => `${e.nombre} (${PLATAFORMAS[e.plataforma].nombre})`).join(', ')}.`,
      porque:
        'La plataforma registra el evento, pero no sabe qué significa. Un Purchase entra en el modelo de optimización de compras y en el ROAS; un nombre inventado no, así que ese dato no ayuda a que las campañas encuentren compradores.',
      hacer: 'Renómbralos al evento estándar equivalente. Si el nombre propio aporta matiz, mándalo como parámetro dentro del evento estándar, no en lugar de él.',
      detalle: inventados.map((e) => `${PLATAFORMAS[e.plataforma].nombre}: ${e.nombre}`),
    })
  }

  // Universal Analytics: dejó de recoger datos en julio de 2024.
  const ua = instalaciones.filter((i) => i.tipo === 'ua')
  if (ua.length) {
    hallazgos.push({
      id: 'universal-analytics',
      gravedad: 'aviso',
      titulo: 'Queda código de Universal Analytics',
      que: `Sigue en la página el identificador ${ua.map((i) => i.id).join(', ')}, de la versión anterior de Google Analytics.`,
      porque:
        'Universal Analytics dejó de recoger datos. No rompe nada, pero cada visita carga un script que no mide, y quien mire ese panel verá datos congelados creyendo que son de este mes.',
      hacer: 'Quita el código antiguo y comprueba que GA4 recibe lo que aquel medía.',
      detalle: [],
    })
  }

  // Qué falta según el tipo de negocio.
  const faltan = []
  for (const et of embudo.etapas) {
    if (!et.obligatoria) continue
    const celdas = filas.map((f) => f.celdas[embudo.etapas.indexOf(et)]).filter((c) => c.estado !== 'nomedible')
    if (celdas.length && celdas.every((c) => c.estado === 'no')) faltan.push(et)
  }
  if (faltan.length) {
    hallazgos.push({
      id: 'embudo-incompleto',
      gravedad: faltan.some((f) => f.conversion) ? 'critico' : 'aviso',
      titulo: `El embudo de ${embudo.nombre.toLowerCase()} tiene ${faltan.length} peldaño${faltan.length > 1 ? 's' : ''} sin medir`,
      que: `Ninguna plataforma declara ${faltan.map((f) => `«${f.nombre}»`).join(', ')} en las URLs revisadas.`,
      porque:
        'Sin esos peldaños no se sabe dónde se cae la gente. Puedes ver que entran mil personas y que compran diez, pero no si el problema es la ficha de producto o el formulario de pago, así que las mejoras se eligen por intuición.',
      hacer: `Añade ${faltan.map((f) => f.nombre.toLowerCase()).join(', ')} en las plataformas que ya tienes instaladas. Ninguno necesita un desarrollo nuevo si el sitio ya usa GTM.`,
      detalle: faltan.map((f) => `${f.nombre}: en Meta sería ${f.meta[0]}, en GA4 ${f.google[0]}`),
    })
  }

  // Lo que sí está bien, para que el informe no sea solo malas noticias.
  if (indiciosCapi) {
    hallazgos.push({
      id: 'capi',
      gravedad: 'bien',
      titulo: 'Hay indicios de Conversions API en Meta',
      que: 'Los eventos llevan un identificador común (eventID), que es lo que usa Meta para no contar dos veces el mismo evento cuando llega por navegador y por servidor.',
      porque:
        'Es la señal de que alguien montó el envío desde servidor. Recupera las conversiones que los bloqueadores y las restricciones del navegador se comen, que en móvil no es poco.',
      hacer: 'Comprueba en el Administrador de eventos que la deduplicación aparece como correcta y que la cobertura del evento de compra está por encima del 90 %.',
      detalle: [],
    })
  }
  if (!instalaciones.filter((i) => i.tipo !== 'gtm').length && leidas.length) {
    hallazgos.push({
      id: 'sin-nada',
      gravedad: 'critico',
      titulo: 'No encontramos ningún píxel en el código servido',
      que: 'Ni Meta, ni GA4, ni TikTok, ni LinkedIn aparecen en el HTML de las páginas que revisamos.',
      porque:
        'Si no hay píxel, no hay público que recuperar ni conversión que optimizar: cada peso invertido en anuncios se gasta sin dejar aprendizaje detrás.',
      hacer:
        'Instala al menos el píxel de la plataforma donde inviertes y GA4. Si el sitio los carga desde una aplicación (Shopify, VTEX, un tema con inyección propia), díselo a quien lo montó: nosotros solo vemos lo que manda el servidor.',
      detalle: [],
    })
  }

  const orden3 = { critico: 0, aviso: 1, bien: 2 }
  hallazgos.sort((a, b) => orden3[a.gravedad] - orden3[b.gravedad])

  // ── Áreas y nota. Solo se puntúa lo que se pudo medir (y se dice). ──────
  const hayPlataformas = filas.length > 0
  const areas = [
    {
      clave: 'instalacion',
      nombre: 'Instalación limpia',
      peso: 25,
      medida: leidas.length > 0,
      nota: Math.max(0, 100 - duplicadas.length * 60 - ua.length * 15),
    },
    {
      clave: 'conversiones',
      nombre: 'Eventos de conversión',
      peso: 30,
      medida: hayPlataformas,
      nota: notaConversiones(filas, embudo),
    },
    {
      clave: 'cobertura',
      nombre: 'Cobertura entre plataformas',
      peso: 20,
      medida: filas.length > 1,
      nota: notaCobertura(filas),
    },
    {
      clave: 'calidad',
      nombre: 'Calidad de los eventos',
      peso: 15,
      medida: listaEventos.length > 0,
      nota: Math.max(0, 100 - inventados.length * 25),
    },
    {
      clave: 'embudo',
      nombre: `Embudo de ${embudo.nombre.toLowerCase()}`,
      peso: 10,
      medida: hayPlataformas,
      nota: Math.max(0, 100 - (faltan.length / Math.max(1, embudo.etapas.filter((e) => e.obligatoria).length)) * 100),
    },
  ].map((a) => ({ ...a, nota: Math.round(Math.min(100, Math.max(0, a.nota))) }))

  const medidas = areas.filter((a) => a.medida)
  const sobre = medidas.reduce((s, a) => s + a.peso, 0)
  const nota = sobre ? Math.round(medidas.reduce((s, a) => s + (a.nota * a.peso) / 100, 0) * (100 / sobre)) : 0

  // ── Qué no se pudo comprobar. Esto va en el informe, no en una nota al pie.
  const cobertura = []
  for (const p of paginas) if (!p.ok) cobertura.push(`No pudimos leer «${p.etiqueta}»: ${p.motivo}`)
  if (paginas.length < 3) {
    cobertura.push(
      `Solo se revisaron ${paginas.length} ${paginas.length === 1 ? 'dirección' : 'direcciones'}. El evento de conversión suele vivir en la página de confirmación, así que sin ella el informe no puede afirmar que falte.`,
    )
  }
  for (const c of contenedores) if (!c.ok) cobertura.push(`No pudimos abrir el contenedor ${c.id}: ${c.motivo}`)
  cobertura.push(
    'Leemos el código que manda el servidor. Los eventos atados a un clic o al envío de un formulario solo existen en ese momento, así que no aparecen aquí ni cuando están bien puestos.',
  )
  if (contenedores.some((c) => c.ok)) {
    cobertura.push(
      'Del contenedor de Google Tag Manager vemos las etiquetas que contiene, pero no en qué condiciones se disparan: una etiqueta presente puede estar pausada o atada a un disparador que no ocurre.',
    )
  }
  const opacas = contenedores.reduce((s, c) => s + (c.opacas || 0), 0)
  if (opacas) {
    cobertura.push(
      `Dentro del contenedor hay ${opacas} etiquetas que sí declaran un evento, pero toman su nombre de una variable que se resuelve en el navegador. Sabemos que existen y no podemos saber qué evento mandan, así que no cuentan en la matriz ni en contra.`,
    )
  }

  return {
    generado: new Date().toISOString(),
    negocio,
    negocioNombre: embudo.nombre,
    paginas,
    contenedores,
    instalaciones: instalaciones.sort((a, b) => orden.indexOf(a.plataforma) - orden.indexOf(b.plataforma)),
    eventos: listaEventos,
    etapas: embudo.etapas.map((e) => ({ clave: e.clave, nombre: e.nombre, corto: e.clave_corta, conversion: !!e.conversion })),
    matriz: filas,
    hallazgos,
    areas,
    nota,
    sobre,
    cobertura,
  }
}

function etiquetaTipo(tipo, plataforma) {
  if (tipo === 'ga4') return 'La propiedad de GA4'
  if (tipo === 'ads') return 'La etiqueta de Google Ads'
  if (tipo === 'gtm') return 'El contenedor'
  if (tipo === 'insight') return 'El Insight Tag de LinkedIn'
  if (tipo === 'ua') return 'La propiedad de Universal Analytics'
  return `El píxel de ${plataforma}`
}

function esVistaDePagina(plataforma, nombre) {
  const n = nombre.toLowerCase()
  if (plataforma === 'meta') return n === 'pageview'
  if (plataforma === 'tiktok') return n === 'pageview'
  if (plataforma === 'google') return n === 'page_view'
  return false
}

function cuentaFila(f) {
  const medibles = f.celdas.filter((c) => c.estado !== 'nomedible')
  const declarados = medibles.filter((c) => c.estado === 'si' || c.estado === 'sinnombre')
  return {
    nombre: f.nombre,
    n: declarados.length,
    medibles: medibles.length,
    ratio: medibles.length ? declarados.length / medibles.length : 0,
  }
}

function notaConversiones(filas, embudo) {
  if (!filas.length) return 0
  const iConv = embudo.etapas.findIndex((e) => e.conversion)
  const juzgables = filas.filter((f) => f.celdas[iConv] && f.celdas[iConv].estado !== 'nomedible')
  if (!juzgables.length) return 0
  return (juzgables.filter((f) => f.celdas[iConv].estado !== 'no').length / juzgables.length) * 100
}

function notaCobertura(filas) {
  if (filas.length < 2) return 100
  const cuentas = filas.map((f) => cuentaFila(f)).filter((c) => c.medibles >= 3)
  if (!cuentas.length) return 0
  const max = Math.max(...cuentas.map((c) => c.ratio))
  const min = Math.min(...cuentas.map((c) => c.ratio))
  if (max === 0) return 0
  return Math.max(0, 100 - (max - min) * 120)
}

// ───────────────────────────  freno y servidor  ─────────────────────────────

const usos = new Map()

function dentroDelLimite(ip, tope) {
  const ahora = Date.now()
  const hora = 60 * 60 * 1000
  const previos = (usos.get(ip) || []).filter((t) => ahora - t < hora)
  if (previos.length >= tope) {
    return { ok: false, espera: Math.ceil((hora - (ahora - previos[0])) / 60000) }
  }
  previos.push(ahora)
  usos.set(ip, previos)
  if (usos.size > 5000) {
    for (const [k, v] of usos) if (v.every((t) => ahora - t >= hora)) usos.delete(k)
  }
  return { ok: true, restantes: tope - previos.length }
}

function json(res, codigo, cuerpo) {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(cuerpo))
}

function ipCliente(req) {
  // OJO: se coge la ÚLTIMA entrada, no la primera. Nuestro nginx usa
  // `$proxy_add_x_forwarded_for`, que AÑADE la IP real al final de lo que
  // mandara el cliente. Leyendo la primera, cualquiera se salta el límite de
  // 5 por hora mandando su propia cabecera con un valor distinto cada vez.
  const reenviada = req.headers['x-forwarded-for']
  if (typeof reenviada === 'string' && reenviada.trim()) {
    const partes = reenviada.split(',').map((p) => p.trim()).filter(Boolean)
    if (partes.length) return partes[partes.length - 1]
  }
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'desconocida')
}

function leerCuerpo(req, tope = 8192) {
  return new Promise((resolve) => {
    let crudo = ''
    req.on('data', (t) => {
      crudo += t
      if (crudo.length > tope) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(crudo || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

function normalizar(entrada) {
  let bruta = String(entrada || '').trim()
  if (!bruta) return null
  if (!/^https?:\/\//i.test(bruta)) bruta = 'https://' + bruta
  let u
  try {
    u = new URL(bruta)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  // Un hostname sin punto es un nombre de contenedor, no una web. Las IPv6
  // llegan entre corchetes y se juzgan aparte: dejar que las pare esta regla
  // sería que la seguridad dependiera de una casualidad ortográfica.
  if (!u.hostname.startsWith('[') && !u.hostname.includes('.')) return null
  u.hash = ''
  return u.href
}

// Una web vive en el 80 o en el 443. Un puerto raro no es una web: es un
// servicio interno al que alguien quiere llegar a través de nosotros. Lo
// encontró la batería de SSRF, no la lectura del código: el guardián dejaba
// pasar `http://31.97.147.227:3000/`, el panel de Easypanel en la IP pública
// de nuestro propio servidor, porque esa IP es pública y el filtro solo miraba
// la dirección. Cerrar por puerto mata la clase entera, no solo ese caso.
function puertoNoWeb(url) {
  try {
    const p = new URL(url).port
    return p !== '' && p !== '80' && p !== '443'
  } catch {
    return true
  }
}

// Una IP literal privada se juzga en la validación, no al descargar: es una
// entrada que no vamos a atender, no trabajo hecho, y así un ataque no gasta
// los cinco análisis de la hora, que se comparten con todo el que salga por la
// misma IP. Lo que llega por DNS lo sigue parando el guardián de la descarga,
// que es donde se puede resolver el nombre.
function apuntaADentro(url) {
  try {
    const soloIp = new URL(url).hostname.replace(/^\[|\]$/g, '')
    return net.isIP(soloIp) !== 0 && !esPublica(soloIp)
  } catch {
    return false
  }
}

const MENSAJES = {
  DESTINO_PRIVADO: 'Esa dirección apunta a una red interna y no se puede auditar.',
  ESQUEMA: 'Solo auditamos direcciones http y https.',
  TIEMPO: 'La página tardó demasiado en responder.',
  SALTOS: 'La página encadena demasiadas redirecciones.',
  ENOTFOUND: 'No existe ninguna web en esa dirección. Revisa que esté bien escrita.',
  ECONNREFUSED: 'El servidor rechazó la conexión.',
  ECONNRESET: 'El servidor cortó la conexión a mitad.',
  CERT_HAS_EXPIRED: 'El certificado de seguridad de esa web ha caducado.',
}

function mensajeDeError(e) {
  const codigo = e.code || ''
  if (MENSAJES[codigo]) return MENSAJES[codigo]
  if (String(codigo).startsWith('ERR_TLS') || String(codigo).includes('CERT')) {
    return 'El certificado de seguridad de esa web da problemas.'
  }
  return 'No pudimos leer esa página. Puede estar caída o bloqueando visitas automáticas.'
}

const servidor = http.createServer(async (req, res) => {
  const ip = ipCliente(req)

  if (req.method === 'GET' && req.url === '/api/salud') {
    return json(res, 200, { ok: true, servicio: 'senal', node: process.version })
  }

  if (req.method === 'POST' && req.url === '/api/analizar') {
    const cuerpo = await leerCuerpo(req)
    // Las URLs se validan ANTES del freno: una dirección mal escrita no debe
    // gastar uno de los cinco análisis de la hora. El freno cuenta trabajo
    // real, no erratas.
    const crudas = Array.isArray(cuerpo.urls) ? cuerpo.urls.slice(0, MAX_URLS) : []
    const urls = []
    for (let i = 0; i < crudas.length; i++) {
      const c = crudas[i]
      if (!String(c || '').trim()) continue
      const n = normalizar(c)
      if (!n) {
        return json(res, 400, { error: `«${String(c).slice(0, 80)}» no parece una dirección web. Prueba con algo como tutienda.com` })
      }
      if (apuntaADentro(n)) {
        return json(res, 400, { error: MENSAJES.DESTINO_PRIVADO })
      }
      if (puertoNoWeb(n)) {
        return json(res, 400, { error: 'Solo auditamos webs en los puertos normales (80 y 443).' })
      }
      // El hueco se salta, pero la etiqueta sigue siendo la del campo que se
      // rellenó: el índice manda, no el orden de llegada.
      urls.push({ url: n, etiqueta: ETIQUETAS_PAGINA[i] || `Página ${i + 1}` })
    }
    if (!urls.length) {
      return json(res, 400, { error: 'Necesitamos al menos la portada del sitio.' })
    }
    const negocio = ['ecommerce', 'leads', 'reservas'].includes(cuerpo.negocio) ? cuerpo.negocio : 'ecommerce'

    const freno = dentroDelLimite(ip, LIMITE_HORA)
    if (!freno.ok) {
      return json(res, 429, {
        error: `Has agotado los ${LIMITE_HORA} análisis de esta hora. Vuelve a intentarlo en ${freno.espera} ${freno.espera === 1 ? 'minuto' : 'minutos'}.`,
      })
    }

    try {
      const informe = await auditar(urls, negocio)
      if (!informe.paginas.some((p) => p.ok)) {
        return json(res, 422, { error: informe.paginas[0]?.motivo || 'No pudimos leer ninguna de las direcciones.' })
      }
      return json(res, 200, informe)
    } catch (e) {
      console.error('[analizar]', e && e.message)
      return json(res, 422, { error: mensajeDeError(e) })
    }
  }

  json(res, 404, { error: 'No existe' })
})

// El generador del informe de ejemplo importa este archivo para usar el motor
// de verdad; con la variable puesta no levanta el puerto. En producción nunca
// va puesta.
if (!process.env.SENAL_SIN_SERVIDOR) {
  servidor.listen(PUERTO, () => console.log(`Señal escuchando en ${PUERTO}`))
}

export { auditar, armarInforme, leerCodigo, normalizarContenedor, resumirContenedor, normalizar, EMBUDOS, PLATAFORMAS, ESTANDAR }
