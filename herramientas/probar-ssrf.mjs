// Batería de SSRF contra la API ya desplegada.
//
// ⚠️ Se ejecuta DENTRO de la red del VPS, nunca desde la máquina de desarrollo.
// Los vectores que de verdad importan son dominios públicos cuyo DNS resuelve a
// una IP privada (127.0.0.1.nip.io y compañía); desde Windows esos nombres no
// resuelven y la prueba sale «rechazado» por el motivo equivocado, sin probar
// nada del guardián. Un verde por la razón equivocada es peor que un rojo.
//
//   docker run --rm --network easypanel-reto30 -v ...:/p node:22-alpine \
//     node /p/probar-ssrf.mjs http://reto30-app11-api:3011

const API = process.argv[2] || 'http://reto30-app11-api:3011'

// Cada ataque va con su propia IP falsa para no agotar el freno del anterior y
// que el error que se lea sea el del guardián, no el del límite (§13.28).
let n = 0

const ATAQUES = [
  ['IP local directa al Postgres del reto', 'http://127.0.0.1:5432/'],
  ['IP local por otra forma de escribirla', 'http://127.1/'],
  ['IPv6 local', 'http://[::1]/'],
  ['IPv4 mapeada en IPv6', 'http://[::ffff:127.0.0.1]/'],
  ['Red interna de docker', 'http://172.17.0.1/'],
  ['Red del proyecto en Easypanel', 'http://10.0.2.1/'],
  ['Metadatos de la nube', 'http://169.254.169.254/latest/meta-data/'],
  ['Rango privado clásico', 'http://192.168.1.1/'],
  ['Contenedor por nombre', 'http://reto30_informes-db:5432/'],
  ['Cero', 'http://0.0.0.0/'],
  // Los cuatro que de verdad hay que probar aquí y no en local: dominios
  // públicos que resuelven hacia dentro.
  ['DNS público → 127.0.0.1 (nip.io)', 'http://127.0.0.1.nip.io/'],
  ['DNS público → 127.0.0.1 (sslip.io)', 'http://127.0.0.1.sslip.io/'],
  ['DNS público → 127.0.0.1 (localtest.me)', 'http://localtest.me/'],
  ['DNS público → red docker (nip.io)', 'http://10.0.2.1.nip.io/'],
  // Esquemas que no son web.
  ['file://', 'file:///etc/passwd'],
  ['gopher://', 'gopher://127.0.0.1:5432/'],
  ['Puerto del panel de Easypanel', 'http://31.97.147.227:3000/'],
]

let bloqueados = 0
let colados = []

for (const [nombre, url] of ATAQUES) {
  n++
  let estado = '?'
  let cuerpo = ''
  try {
    const r = await fetch(`${API}/api/analizar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${n}` },
      body: JSON.stringify({ urls: [url], negocio: 'ecommerce' }),
    })
    estado = r.status
    cuerpo = (await r.text()).slice(0, 160)
  } catch (e) {
    estado = 'ERR'
    cuerpo = e.message
  }
  // Un 200 significa que la API llegó a leer algo de ese destino: eso es el
  // agujero. Cualquier 4xx es el guardián haciendo su trabajo.
  const parado = estado !== 200
  if (parado) bloqueados++
  else colados.push(nombre)
  console.log(`${parado ? ' PARADO ' : ' ¡PASÓ! '} ${String(estado).padEnd(4)} ${nombre}\n           ${url}\n           ${cuerpo}`)
}

// Un destino público legítimo TIENE que seguir funcionando: si el guardián
// bloquea todo, la prueba sale verde y la app no sirve para nada.
console.log('\n· Control: un destino público normal debe pasar')
const r = await fetch(`${API}/api/analizar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.250' },
  body: JSON.stringify({ urls: ['https://example.com/'], negocio: 'ecommerce' }),
})
console.log(`  ${r.status === 200 ? 'OK' : 'MAL'} example.com respondió ${r.status}`)

console.log(`\n${bloqueados} de ${ATAQUES.length} ataques parados.`)
if (colados.length) console.log('SE COLARON: ' + colados.join(', '))
process.exit(colados.length || r.status !== 200 ? 1 : 0)
