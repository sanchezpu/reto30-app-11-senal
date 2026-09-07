// GENERADO por herramientas/generar-demo.mjs — no editar a mano.
// Sale del motor real de la API sobre las páginas de herramientas/ejemplo/,
// así que el informe de ejemplo cumple exactamente las mismas reglas que uno
// de verdad. Para regenerarlo: node herramientas/generar-demo.mjs
import type { Informe } from './tipos'

export const DEMO: Informe = {
  "generado": "2026-09-06T09:12:00.000Z",
  "negocio": "ecommerce",
  "negocioNombre": "Tienda online",
  "paginas": [
    {
      "url": "https://aurorabotanica.co/",
      "etiqueta": "Portada",
      "ok": true,
      "bytes": 1491,
      "cortada": false
    },
    {
      "url": "https://aurorabotanica.co/producto/serum-rosa-mosqueta",
      "etiqueta": "Producto o servicio",
      "ok": true,
      "bytes": 1886,
      "cortada": false
    },
    {
      "url": "https://aurorabotanica.co/gracias",
      "etiqueta": "Gracias o confirmación",
      "ok": true,
      "bytes": 1714,
      "cortada": false
    }
  ],
  "contenedores": [
    {
      "id": "GTM-N8PZK4Q",
      "ok": true,
      "bytes": 4207,
      "etiquetas": [
        {
          "clave": "Otras etiquetas",
          "nombre": "Otras etiquetas",
          "n": 5
        },
        {
          "clave": "Evento de GA4",
          "nombre": "Evento de GA4",
          "n": 3
        },
        {
          "clave": "HTML personalizado",
          "nombre": "HTML personalizado",
          "n": 3
        },
        {
          "clave": "Plantilla de la galería",
          "nombre": "Plantilla de la galería",
          "n": 2
        },
        {
          "clave": "Etiqueta de Google",
          "nombre": "Etiqueta de Google",
          "n": 1
        },
        {
          "clave": "Conversión de Google Ads",
          "nombre": "Conversión de Google Ads",
          "n": 1
        },
        {
          "clave": "Enlace de conversiones de Google",
          "nombre": "Enlace de conversiones de Google",
          "n": 1
        },
        {
          "clave": "Píxel de imagen",
          "nombre": "Píxel de imagen",
          "n": 1
        }
      ],
      "total": 17,
      "opacas": 0
    }
  ],
  "instalaciones": [
    {
      "plataforma": "meta",
      "tipo": "pixel",
      "id": "1042577819384210",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "fbq('init')",
        "imagen <noscript>",
        "etiqueta de GTM"
      ],
      "duplicada": {
        "pagina": 0,
        "fuentes": [
          "el código de la página",
          "el contenedor GTM-N8PZK4Q"
        ]
      }
    },
    {
      "plataforma": "google",
      "tipo": "gtm",
      "id": "GTM-N8PZK4Q",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "referencia a GTM"
      ],
      "duplicada": null
    },
    {
      "plataforma": "google",
      "tipo": "ga4",
      "id": "G-7QM4XKD2LP",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "gtag('config')",
        "cargador gtag.js",
        "referencia"
      ],
      "duplicada": null
    },
    {
      "plataforma": "google",
      "tipo": "ads",
      "id": "AW-11209384756",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "conversión de Google Ads"
      ],
      "duplicada": null
    },
    {
      "plataforma": "tiktok",
      "tipo": "pixel",
      "id": "CQ8F7JBC77U1A9K2M3RG",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "ttq.load()"
      ],
      "duplicada": null
    },
    {
      "plataforma": "linkedin",
      "tipo": "insight",
      "id": "5842097",
      "paginas": [
        0,
        1,
        2
      ],
      "vias": [
        "_linkedin_partner_id",
        "píxel de respaldo"
      ],
      "duplicada": null
    }
  ],
  "eventos": [
    {
      "plataforma": "google",
      "nombre": "add_to_cart",
      "estandar": true,
      "paginas": [],
      "origenes": [
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "google",
      "nombre": "page_view",
      "estandar": true,
      "paginas": [
        0,
        1,
        2
      ],
      "origenes": [
        "automático al configurar GA4"
      ]
    },
    {
      "plataforma": "google",
      "nombre": "purchase",
      "estandar": true,
      "paginas": [],
      "origenes": [
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "google",
      "nombre": "view_item",
      "estandar": true,
      "paginas": [],
      "origenes": [
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "meta",
      "nombre": "AddToCart",
      "estandar": true,
      "paginas": [
        1
      ],
      "origenes": [
        "código de la página",
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "meta",
      "nombre": "compra_confirmada",
      "estandar": false,
      "paginas": [
        2
      ],
      "origenes": [
        "código de la página"
      ]
    },
    {
      "plataforma": "meta",
      "nombre": "PageView",
      "estandar": true,
      "paginas": [
        0,
        1,
        2
      ],
      "origenes": [
        "código de la página",
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "meta",
      "nombre": "Purchase",
      "estandar": true,
      "paginas": [
        2
      ],
      "origenes": [
        "código de la página"
      ]
    },
    {
      "plataforma": "meta",
      "nombre": "ViewContent",
      "estandar": true,
      "paginas": [
        1
      ],
      "origenes": [
        "código de la página",
        "contenedor GTM-N8PZK4Q"
      ]
    },
    {
      "plataforma": "tiktok",
      "nombre": "Pageview",
      "estandar": true,
      "paginas": [],
      "origenes": [
        "contenedor GTM-N8PZK4Q"
      ]
    }
  ],
  "etapas": [
    {
      "clave": "visita",
      "nombre": "Visita",
      "corto": "Visita",
      "conversion": false
    },
    {
      "clave": "producto",
      "nombre": "Ver producto",
      "corto": "Producto",
      "conversion": false
    },
    {
      "clave": "carrito",
      "nombre": "Añadir al carrito",
      "corto": "Carrito",
      "conversion": false
    },
    {
      "clave": "pago",
      "nombre": "Iniciar pago",
      "corto": "Pago",
      "conversion": false
    },
    {
      "clave": "compra",
      "nombre": "Compra",
      "corto": "Compra",
      "conversion": true
    }
  ],
  "matriz": [
    {
      "plataforma": "meta",
      "nombre": "Meta",
      "celdas": [
        {
          "estado": "si",
          "evento": "PageView"
        },
        {
          "estado": "si",
          "evento": "ViewContent"
        },
        {
          "estado": "si",
          "evento": "AddToCart"
        },
        {
          "estado": "no",
          "evento": ""
        },
        {
          "estado": "si",
          "evento": "Purchase"
        }
      ]
    },
    {
      "plataforma": "google",
      "nombre": "Google",
      "celdas": [
        {
          "estado": "si",
          "evento": "page_view"
        },
        {
          "estado": "si",
          "evento": "view_item"
        },
        {
          "estado": "si",
          "evento": "add_to_cart"
        },
        {
          "estado": "no",
          "evento": ""
        },
        {
          "estado": "si",
          "evento": "purchase"
        }
      ]
    },
    {
      "plataforma": "tiktok",
      "nombre": "TikTok",
      "celdas": [
        {
          "estado": "si",
          "evento": "Pageview"
        },
        {
          "estado": "no",
          "evento": ""
        },
        {
          "estado": "no",
          "evento": ""
        },
        {
          "estado": "no",
          "evento": ""
        },
        {
          "estado": "no",
          "evento": ""
        }
      ]
    },
    {
      "plataforma": "linkedin",
      "nombre": "LinkedIn",
      "celdas": [
        {
          "estado": "si",
          "evento": "Insight Tag"
        },
        {
          "estado": "nomedible",
          "evento": ""
        },
        {
          "estado": "nomedible",
          "evento": ""
        },
        {
          "estado": "nomedible",
          "evento": ""
        },
        {
          "estado": "nomedible",
          "evento": ""
        }
      ]
    }
  ],
  "hallazgos": [
    {
      "id": "duplicado-meta-1042577819384210",
      "gravedad": "critico",
      "titulo": "El píxel de Meta 1042577819384210 se carga dos veces",
      "que": "En «Portada» el mismo identificador se inicia desde el código de la página y desde el contenedor GTM-N8PZK4Q.",
      "porque": "Cada visita y cada conversión se cuentan dos veces. El panel enseña el doble de ventas de las que hubo, el coste por conversión sale a la mitad y el algoritmo aprende de datos falsos: acaba comprando el tráfico equivocado con tu presupuesto real.",
      "hacer": "Deja una sola carga. Lo habitual es quitar el código pegado a mano en la plantilla del sitio y conservar el que vive en el contenedor GTM-N8PZK4Q, que es donde se puede cambiar sin tocar la web.",
      "detalle": [
        "Visto en: fbq('init'), imagen <noscript>, etiqueta de GTM"
      ]
    },
    {
      "id": "sin-eventos-tiktok",
      "gravedad": "critico",
      "titulo": "El píxel de TikTok CQ8F7JBC77U1A9K2M3RG solo registra visitas",
      "que": "Está instalado y disparando la vista de página, pero no encontramos ni un solo evento de conversión en las URLs que revisamos.",
      "porque": "Una campaña configurada para optimizar a conversiones no recibe ninguna señal de qué visita acabó en venta. La plataforma reparte el presupuesto a ciegas y el panel de TikTok Events Manager enseña cero conversiones aunque el negocio sí venda.",
      "hacer": "Declara al menos el cierre del embudo (CompletePayment) en la página de confirmación, con su valor y su moneda.",
      "detalle": []
    },
    {
      "id": "cobertura-desigual",
      "gravedad": "aviso",
      "titulo": "TikTok mide mucho menos que Meta",
      "que": "Meta declara 4 de los 5 peldaños del embudo que puede declarar, y TikTok solo 1 de 5.",
      "porque": "Cada panel cuenta una historia distinta del mismo mes. Al comparar plataformas para decidir dónde poner el presupuesto, la que peor mide siempre parece la que peor funciona, aunque esté vendiendo igual.",
      "hacer": "Replica en TikTok los mismos eventos que ya tienes en Meta. Si usas GTM, es duplicar el disparador y cambiar la etiqueta.",
      "detalle": [
        "Meta: 4 de 5",
        "Google: 4 de 5",
        "TikTok: 1 de 5"
      ]
    },
    {
      "id": "eventos-inventados",
      "gravedad": "aviso",
      "titulo": "1 evento con nombre propio en vez del estándar",
      "que": "Se declaran como eventos personalizados: compra_confirmada (Meta).",
      "porque": "La plataforma registra el evento, pero no sabe qué significa. Un Purchase entra en el modelo de optimización de compras y en el ROAS; un nombre inventado no, así que ese dato no ayuda a que las campañas encuentren compradores.",
      "hacer": "Renómbralos al evento estándar equivalente. Si el nombre propio aporta matiz, mándalo como parámetro dentro del evento estándar, no en lugar de él.",
      "detalle": [
        "Meta: compra_confirmada"
      ]
    },
    {
      "id": "embudo-incompleto",
      "gravedad": "aviso",
      "titulo": "El embudo de tienda online tiene 1 peldaño sin medir",
      "que": "Ninguna plataforma declara «Iniciar pago» en las URLs revisadas.",
      "porque": "Sin esos peldaños no se sabe dónde se cae la gente. Puedes ver que entran mil personas y que compran diez, pero no si el problema es la ficha de producto o el formulario de pago, así que las mejoras se eligen por intuición.",
      "hacer": "Añade iniciar pago en las plataformas que ya tienes instaladas. Ninguno necesita un desarrollo nuevo si el sitio ya usa GTM.",
      "detalle": [
        "Iniciar pago: en Meta sería InitiateCheckout, en GA4 begin_checkout"
      ]
    },
    {
      "id": "capi",
      "gravedad": "bien",
      "titulo": "Hay indicios de Conversions API en Meta",
      "que": "Los eventos llevan un identificador común (eventID), que es lo que usa Meta para no contar dos veces el mismo evento cuando llega por navegador y por servidor.",
      "porque": "Es la señal de que alguien montó el envío desde servidor. Recupera las conversiones que los bloqueadores y las restricciones del navegador se comen, que en móvil no es poco.",
      "hacer": "Comprueba en el Administrador de eventos que la deduplicación aparece como correcta y que la cobertura del evento de compra está por encima del 90 %.",
      "detalle": []
    }
  ],
  "areas": [
    {
      "clave": "instalacion",
      "nombre": "Instalación limpia",
      "peso": 25,
      "medida": true,
      "nota": 40
    },
    {
      "clave": "conversiones",
      "nombre": "Eventos de conversión",
      "peso": 30,
      "medida": true,
      "nota": 67
    },
    {
      "clave": "cobertura",
      "nombre": "Cobertura entre plataformas",
      "peso": 20,
      "medida": true,
      "nota": 28
    },
    {
      "clave": "calidad",
      "nombre": "Calidad de los eventos",
      "peso": 15,
      "medida": true,
      "nota": 75
    },
    {
      "clave": "embudo",
      "nombre": "Embudo de tienda online",
      "peso": 10,
      "medida": true,
      "nota": 75
    }
  ],
  "nota": 54,
  "sobre": 100,
  "cobertura": [
    "Leemos el código que manda el servidor. Los eventos atados a un clic o al envío de un formulario solo existen en ese momento, así que no aparecen aquí ni cuando están bien puestos.",
    "Del contenedor de Google Tag Manager vemos las etiquetas que contiene, pero no en qué condiciones se disparan: una etiqueta presente puede estar pausada o atada a un disparador que no ocurre."
  ],
  "ejemplo": true,
  "sitio": "aurorabotanica.co"
}
