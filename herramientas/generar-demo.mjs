// Genera el informe de ejemplo que la app enseña al abrirse.
//
// Pasa por EL MOTOR DE VERDAD: no hay un informe escrito a mano en ninguna
// parte. Lo único que se sustituye es la descarga, que en vez de salir a
// internet lee los ficheros de `ejemplo/`. Un ejemplo que se saltara las
// reglas que la app promete la desmentiría entera, y nadie lo mira porque
// «es solo la demo».
//
//   node herramientas/generar-demo.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

process.env.SENAL_SIN_SERVIDOR = '1'
const { auditar } = await import('../server/server.js')

const aqui = dirname(fileURLToPath(import.meta.url))
const leer = (f) => readFileSync(join(aqui, 'ejemplo', f), 'utf8')

const SITIO = 'https://aurorabotanica.co'
const FICHEROS = {
  [`${SITIO}/`]: 'portada.html',
  [`${SITIO}/producto/serum-rosa-mosqueta`]: 'producto.html',
  [`${SITIO}/gracias`]: 'gracias.html',
  'https://www.googletagmanager.com/gtm.js?id=GTM-N8PZK4Q': 'gtm.js',
}

async function traerDeDisco(url) {
  const fichero = FICHEROS[url]
  if (!fichero) throw Object.assign(new Error('sin fixture'), { code: 'ENOTFOUND' })
  const cuerpo = leer(fichero)
  return {
    estado: 200,
    cabeceras: { 'content-type': fichero.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8' },
    cuerpo,
    bytes: Buffer.byteLength(cuerpo),
    cortado: false,
    url,
    urlFinal: url,
  }
}

const informe = await auditar(Object.keys(FICHEROS).filter((u) => u.startsWith(SITIO)), 'ecommerce', traerDeDisco)

// La fecha del ejemplo va fija: si cambiara en cada build, el informe
// compartido de ayer y el de hoy serían distintos sin que nadie tocara nada.
informe.generado = '2026-09-06T09:12:00.000Z'
informe.ejemplo = true
informe.sitio = 'aurorabotanica.co'

const salida = `// GENERADO por herramientas/generar-demo.mjs — no editar a mano.
// Sale del motor real de la API sobre las páginas de herramientas/ejemplo/,
// así que el informe de ejemplo cumple exactamente las mismas reglas que uno
// de verdad. Para regenerarlo: node herramientas/generar-demo.mjs
import type { Informe } from './tipos'

export const DEMO: Informe = ${JSON.stringify(informe, null, 2)}
`

writeFileSync(join(aqui, '..', 'src', 'demo.ts'), salida)

console.log('Informe de ejemplo generado.')
console.log(`  nota ${informe.nota} sobre ${informe.sobre} puntos medibles`)
console.log(`  ${informe.instalaciones.length} instalaciones · ${informe.eventos.length} eventos`)
for (const h of informe.hallazgos) console.log(`  [${h.gravedad}] ${h.titulo}`)
