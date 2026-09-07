// Pruebas del motor de detección, sin red y sin navegador.
//
// La promesa del producto es el diagnóstico de píxel duplicado. Un falso
// positivo ahí es peor que no detectarlo: le dices a alguien que sus ventas
// están infladas cuando no lo están. Estas pruebas atacan justo eso, con los
// cuatro casos que en una web real se parecen a un duplicado y no lo son.
//
//   node herramientas/probar-motor.mjs

process.env.SENAL_SIN_SERVIDOR = '1'
const { auditar } = await import('../server/server.js')

let fallos = 0
function comprobar(nombre, condicion, detalle = '') {
  console.log(`${condicion ? '  OK  ' : '  MAL '} ${nombre}${detalle && !condicion ? ` → ${detalle}` : ''}`)
  if (!condicion) fallos++
}

// Un lector de páginas de mentira: devuelve lo que se le pase en el mapa.
function lector(mapa) {
  return async (url) => {
    if (!(url in mapa)) throw Object.assign(new Error('sin fixture'), { code: 'ENOTFOUND' })
    const cuerpo = mapa[url]
    return { estado: 200, cabeceras: { 'content-type': 'text/html' }, cuerpo, bytes: Buffer.byteLength(cuerpo), cortado: false, url, urlFinal: url }
  }
}

const PORTADA = 'https://ejemplo.test/'
const GTM = 'https://www.googletagmanager.com/gtm.js?id=GTM-AAAA111'

const relleno = '/* '.padEnd(2400, 'x') + ' */\n'
const contenedor = (etiquetas) => relleno + `var data = {"resource":{"tags":[${etiquetas.join(',')}]}};`

const html = (dentro) => `<!doctype html><html><head><script>
  (function(w,d,s,l,i){w[l]=w[l]||[];var j=d.createElement(s);
  j.src='https://www.googletagmanager.com/gtm.js?id='+i;})(window,document,'script','dataLayer','GTM-AAAA111');
</script>${dentro}</head><body>Hola</body></html>`

const SNIPPET_META = `<script>
  fbq('init', '1042577819384210');
  fbq('track', 'PageView');
</script>
<noscript><img src="https://www.facebook.com/tr?id=1042577819384210&ev=PageView&noscript=1" /></noscript>`

const dup = (informe) => informe.instalaciones.filter((i) => i.duplicada)

console.log('\n· El píxel solo está en el HTML, con su <noscript>')
{
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(SNIPPET_META), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  comprobar('no lo marca duplicado', dup(inf).length === 0, `marcó ${dup(inf).length}`)
  comprobar('sí ve el píxel', inf.instalaciones.some((i) => i.plataforma === 'meta' && i.id === '1042577819384210'))
}

console.log('\n· El píxel solo está en GTM, con cinco etiquetas que citan el mismo ID')
{
  const etiquetas = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead'].map(
    (e, n) => `{"function":"__cvt_99_1","vtp_pixelId":"1042577819384210","vtp_eventName":"${e}","tag_id":${n}}`,
  )
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(''), [GTM]: contenedor(etiquetas) }))
  comprobar('no lo marca duplicado', dup(inf).length === 0, `marcó ${dup(inf).length}`)
  comprobar('recoge los cinco eventos', inf.eventos.filter((e) => e.plataforma === 'meta').length === 5)
}

console.log('\n· El mismo píxel a mano Y dentro de GTM (el duplicado de verdad)')
{
  const etiqueta = `{"function":"__html","vtp_html":"<script>fbq('init', '1042577819384210');<\\/script>","tag_id":1}`
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(SNIPPET_META), [GTM]: contenedor([etiqueta]) }))
  comprobar('lo marca duplicado', dup(inf).length === 1, `marcó ${dup(inf).length}`)
  comprobar('nombra las dos fuentes', (dup(inf)[0]?.duplicada.fuentes || []).length === 2, JSON.stringify(dup(inf)[0]?.duplicada))
  comprobar('el hallazgo es crítico', inf.hallazgos.some((h) => h.gravedad === 'critico' && h.id.startsWith('duplicado-')))
}

console.log('\n· El mismo píxel pegado dos veces en la misma página')
{
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(SNIPPET_META + SNIPPET_META), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  comprobar('lo marca duplicado', dup(inf).length === 1, `marcó ${dup(inf).length}`)
  comprobar('dice cuántas veces', (dup(inf)[0]?.duplicada.fuentes[0] || '').includes('2 veces'), JSON.stringify(dup(inf)[0]?.duplicada))
}

console.log('\n· Dos píxeles DISTINTOS de Meta (agencia + cliente): no es duplicado')
{
  const dos = SNIPPET_META + `<script>fbq('init', '2298374651029384');</script>`
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(dos), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  comprobar('no marca ninguno duplicado', dup(inf).length === 0, `marcó ${dup(inf).length}`)
  comprobar('ve los dos píxeles', inf.instalaciones.filter((i) => i.plataforma === 'meta').length === 2)
}

console.log('\n· LinkedIn: conversión por número, no por nombre')
{
  const li = `<script>_linkedin_partner_id = "5842097";
    lintrk('track', { conversion_id: 9182736 });</script>`
  const inf = await auditar([PORTADA], 'leads', lector({ [PORTADA]: html(li), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  comprobar('ve el Insight Tag', inf.instalaciones.some((i) => i.plataforma === 'linkedin' && i.id === '5842097'))
  comprobar('ve la conversión', inf.eventos.some((e) => e.plataforma === 'linkedin' && e.nombre === 'Conversión 9182736'))
  const fila = inf.matriz.find((f) => f.plataforma === 'linkedin')
  comprobar('la matriz la coloca en el peldaño de cierre', fila?.celdas.at(-1).estado === 'sinnombre', JSON.stringify(fila?.celdas))
}

console.log('\n· Un evento de Meta dentro de GTM no se atribuye a Google')
{
  const etiquetas = [
    `{"function":"__cvt_99_1","vtp_pixelId":"1042577819384210","vtp_eventName":"Purchase","tag_id":1}`,
    `{"function":"__gaawe","vtp_eventName":"purchase","vtp_measurementIdOverride":["macro",4],"tag_id":2}`,
  ]
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(''), [GTM]: contenedor(etiquetas) }))
  comprobar('Purchase es de Meta', inf.eventos.some((e) => e.plataforma === 'meta' && e.nombre === 'Purchase'))
  comprobar('purchase es de Google', inf.eventos.some((e) => e.plataforma === 'google' && e.nombre === 'purchase'))
  comprobar('Meta no hereda el evento de Google', !inf.eventos.some((e) => e.plataforma === 'meta' && e.nombre === 'purchase'))
}


console.log('\n· El mismo píxel iniciado por DOS etiquetas de HTML del mismo contenedor')
{
  const dosVeces = [
    `{"function":"__html","vtp_html":"<script>fbq('init', '1042577819384210');<\/script>","tag_id":1}`,
    `{"function":"__html","vtp_html":"<script>fbq('init', '1042577819384210');fbq('track','PageView');<\/script>","tag_id":2}`,
  ]
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(''), [GTM]: contenedor(dosVeces) }))
  comprobar('lo marca duplicado', dup(inf).length === 1, `marcó ${dup(inf).length}`)
  comprobar('dice que son dos etiquetas', (dup(inf)[0]?.duplicada.fuentes[0] || '').includes('2 etiquetas'), JSON.stringify(dup(inf)[0]?.duplicada))
}

console.log('\n· Código base en HTML personalizado + eventos por plantilla: NO es duplicado')
{
  const montajeCorrecto = [
    `{"function":"__html","vtp_html":"<script>fbq('init', '1042577819384210');<\/script>","tag_id":1}`,
    `{"function":"__cvt_99_1","vtp_pixelId":"1042577819384210","vtp_eventName":"ViewContent","tag_id":2}`,
    `{"function":"__cvt_99_1","vtp_pixelId":"1042577819384210","vtp_eventName":"Purchase","tag_id":3}`,
  ]
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(''), [GTM]: contenedor(montajeCorrecto) }))
  comprobar('no marca duplicado', dup(inf).length === 0, `marcó ${dup(inf).length}`)
  comprobar('y aun así ve los eventos', inf.eventos.filter((e) => e.plataforma === 'meta').length === 2)
}

console.log('\n· Una página que no se pudo leer se declara, no se calla')
{
  const inf = await auditar([{ url: PORTADA, etiqueta: 'Portada' }, { url: 'https://ejemplo.test/gracias', etiqueta: 'Gracias o confirmación' }], 'ecommerce', lector({ [PORTADA]: html(SNIPPET_META), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  comprobar('la página fallida queda marcada', inf.paginas.filter((p) => !p.ok).length === 1)
  comprobar('lo dice en la cobertura', inf.cobertura.some((c) => c.includes('Gracias o confirmación')), JSON.stringify(inf.cobertura))
  comprobar('avisa de lo que no se ve desde el HTML', inf.cobertura.some((c) => c.includes('atados a un clic')))
}

console.log('\n· La nota se calcula solo sobre lo que se pudo medir')
{
  const inf = await auditar([PORTADA], 'ecommerce', lector({ [PORTADA]: html(''), [GTM]: contenedor(['{"function":"__gclidw","tag_id":1}']) }))
  const suma = inf.areas.filter((a) => a.medida).reduce((s, a) => s + a.peso, 0)
  comprobar('«sobre» coincide con los pesos medidos', inf.sobre === suma, `sobre=${inf.sobre} pesos=${suma}`)
  comprobar('sin píxeles, no se puntúan las áreas que dependen de ellos', inf.sobre < 100, `sobre=${inf.sobre}`)
  comprobar('y lo dice como hallazgo', inf.hallazgos.some((h) => h.id === 'sin-nada'))
}

console.log(fallos ? `\n${fallos} comprobaciones MAL\n` : '\nTodas las comprobaciones pasan.\n')
process.exit(fallos ? 1 : 0)
