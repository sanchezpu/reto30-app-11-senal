import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  FileText,
  Layers,
  Link2,
  Minus,
  Printer,
  ShieldQuestion,
  Tag,
} from 'lucide-react'
import type { Celda, Gravedad, Informe as TInforme, Instalacion, Plataforma } from './tipos'
import { informeAEnlace } from './compartir'

const COLOR_PLATAFORMA: Record<Plataforma, string> = {
  meta: 'text-meta',
  google: 'text-google',
  tiktok: 'text-tiktok',
  linkedin: 'text-linkedin',
}

const NOMBRE_TIPO: Record<Instalacion['tipo'], string> = {
  pixel: 'Píxel',
  ga4: 'Propiedad de GA4',
  gtm: 'Contenedor de Tag Manager',
  ads: 'Etiqueta de Google Ads',
  ua: 'Universal Analytics',
  insight: 'Insight Tag',
}

const NOMBRE_PLATAFORMA: Record<Plataforma, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

function colorNota(n: number) {
  if (n >= 75) return { texto: 'text-senal', barra: 'bg-senal' }
  if (n >= 50) return { texto: 'text-aviso', barra: 'bg-aviso' }
  return { texto: 'text-critico', barra: 'bg-critico' }
}

const ESTILO_GRAVEDAD: Record<Gravedad, { borde: string; fondo: string; texto: string; etiqueta: string }> = {
  critico: { borde: 'border-criticoHondo', fondo: 'bg-criticoFondo', texto: 'text-critico', etiqueta: 'Crítico' },
  aviso: { borde: 'border-avisoHondo', fondo: 'bg-avisoFondo', texto: 'text-aviso', etiqueta: 'Revisar' },
  bien: { borde: 'border-senalHondo', fondo: 'bg-senalFondo', texto: 'text-senal', etiqueta: 'Bien hecho' },
}

function IconoGravedad({ g }: { g: Gravedad }) {
  if (g === 'critico') return <CircleAlert className="h-5 w-5 shrink-0" aria-hidden />
  if (g === 'aviso') return <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
  return <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />
}

function CeldaMatriz({ c }: { c: Celda }) {
  if (c.estado === 'si') {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg bg-senalFondo px-2 py-2.5 text-senal">
        <Check className="h-4 w-4" aria-hidden />
        <span className="cifra text-[10px] leading-tight text-center break-all">{c.evento}</span>
      </div>
    )
  }
  if (c.estado === 'sinnombre') {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg bg-avisoFondo px-2 py-2.5 text-aviso">
        <Check className="h-4 w-4" aria-hidden />
        <span className="text-[10px] leading-tight text-center">{c.evento}</span>
      </div>
    )
  }
  if (c.estado === 'nomedible') {
    return (
      <div
        className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-borde px-2 py-2.5 text-textoTenue"
        title="LinkedIn no pone nombre a sus conversiones, así que no se puede saber a qué peldaño corresponde cada una."
      >
        <Minus className="h-4 w-4" aria-hidden />
        <span className="text-[10px] leading-tight">no aplica</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-criticoFondo px-2 py-2.5 text-critico">
      <Minus className="h-4 w-4" aria-hidden />
      <span className="text-[10px] leading-tight">sin señal</span>
    </div>
  )
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10 evitar-corte">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-senal" aria-hidden>
          {icono}
        </span>
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Informe({ informe, alReiniciar }: { informe: TInforme; alReiniciar?: () => void }) {
  const [copiado, setCopiado] = useState<'no' | 'si' | 'largo'>('no')
  const color = colorNota(informe.nota)
  const criticos = informe.hallazgos.filter((h) => h.gravedad === 'critico').length
  const sitio = informe.sitio || nombreDeSitio(informe)
  const conGtm = informe.contenedores.filter((c) => c.ok)

  function copiarEnlace() {
    const enlace = informeAEnlace(informe)
    if (!enlace) return setCopiado('largo')
    navigator.clipboard.writeText(enlace).then(
      () => {
        history.replaceState(null, '', enlace)
        setCopiado('si')
        setTimeout(() => setCopiado('no'), 4000)
      },
      () => setCopiado('largo'),
    )
  }

  return (
    <div className="medida pb-20">
      {/* ── Encabezado del informe ─────────────────────────────────────── */}
      <div className="tarjeta mt-8 p-6 sm:p-8 evitar-corte">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-senal">
              {informe.ejemplo ? 'Informe de ejemplo' : 'Informe de medición'}
            </p>
            <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">{sitio}</h1>
            <p className="mt-1 text-sm text-textoSuave">
              {informe.negocioNombre} · {informe.paginas.filter((p) => p.ok).length} de {informe.paginas.length}{' '}
              {informe.paginas.length === 1 ? 'página leída' : 'páginas leídas'} ·{' '}
              {new Date(informe.generado).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <div className={`cifra text-5xl font-semibold leading-none ${color.texto}`}>{informe.nota}</div>
            <p className="mt-1 text-xs text-textoTenue">
              sobre {informe.sobre} puntos
              <br />
              medibles
            </p>
          </div>
        </div>

        {informe.sobre < 100 && (
          <p className="mt-4 rounded-lg bg-panelAlto px-3 py-2 text-xs text-textoSuave">
            La nota se calcula solo sobre las áreas que se pudieron medir. Los {100 - informe.sobre} puntos restantes
            no se descuentan: se quedan fuera del cálculo y se explican al final.
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {informe.areas.map((a) => (
            <div key={a.clave} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-textoSuave">{a.nombre}</span>
                  <span className={`cifra text-sm ${a.medida ? colorNota(a.nota).texto : 'text-textoTenue'}`}>
                    {a.medida ? a.nota : 'sin medir'}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panelAlto">
                  <div
                    className={`h-full rounded-full ${a.medida ? colorNota(a.nota).barra : 'bg-borde'}`}
                    style={{ width: a.medida ? `${a.nota}%` : '100%' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="no-imprimir mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-senal px-4 py-2 text-sm font-semibold text-fondo hover:bg-senal/90"
          >
            <Printer className="h-4 w-4" aria-hidden /> Imprimir o guardar en PDF
          </button>
          <button
            onClick={copiarEnlace}
            className="inline-flex items-center gap-2 rounded-lg border border-bordeVivo px-4 py-2 text-sm font-semibold text-texto hover:bg-panelAlto"
          >
            {copiado === 'si' ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {copiado === 'si' ? 'Enlace copiado' : 'Copiar enlace del informe'}
          </button>
          {alReiniciar && (
            <button
              onClick={alReiniciar}
              className="inline-flex items-center gap-2 rounded-lg border border-bordeVivo px-4 py-2 text-sm font-semibold text-texto hover:bg-panelAlto"
            >
              <Copy className="h-4 w-4" aria-hidden /> Analizar otro sitio
            </button>
          )}
        </div>
        {copiado === 'largo' && (
          <p className="no-imprimir mt-2 text-xs text-aviso">
            Este informe es demasiado largo para caber en un enlace. Usa «Imprimir o guardar en PDF» para compartirlo.
          </p>
        )}
      </div>

      {/* ── Hallazgos ──────────────────────────────────────────────────── */}
      <Seccion
        titulo={criticos ? `Qué hay que arreglar (${criticos} crítico${criticos > 1 ? 's' : ''})` : 'Qué encontramos'}
        icono={<CircleAlert className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {informe.hallazgos.map((h) => {
            const e = ESTILO_GRAVEDAD[h.gravedad]
            return (
              <article key={h.id} className={`evitar-corte rounded-xl border ${e.borde} ${e.fondo} p-5`}>
                <div className={`flex items-start gap-3 ${e.texto}`}>
                  <IconoGravedad g={h.gravedad} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest">{e.etiqueta}</p>
                    <h3 className="mt-0.5 text-base font-semibold text-texto sm:text-lg">{h.titulo}</h3>
                  </div>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-widest text-textoTenue">Qué pasa</dt>
                    <dd className="mt-1 text-textoSuave">{h.que}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-widest text-textoTenue">
                      Por qué importa
                    </dt>
                    <dd className="mt-1 text-textoSuave">{h.porque}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-widest text-textoTenue">Qué hacer</dt>
                    <dd className="mt-1 text-texto">{h.hacer}</dd>
                  </div>
                </dl>
                {!!h.detalle?.length && (
                  <ul className="mt-3 space-y-1 border-t border-borde pt-3 text-xs text-textoTenue">
                    {h.detalle.map((d) => (
                      <li key={d} className="cifra">
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
          {!informe.hallazgos.length && (
            <p className="tarjeta p-5 text-sm text-textoSuave">
              No encontramos nada que señalar en las páginas revisadas. Eso no significa que la medición sea perfecta:
              lee abajo qué se pudo comprobar y qué no.
            </p>
          )}
        </div>
      </Seccion>

      {/* ── Matriz ─────────────────────────────────────────────────────── */}
      {!!informe.matriz.length && (
        <Seccion titulo="Qué mide cada plataforma" icono={<Layers className="h-5 w-5" />}>
          <div className="tarjeta overflow-x-auto p-4 sm:p-5">
            <div className="min-w-[560px]">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `minmax(88px, 108px) repeat(${informe.etapas.length}, minmax(0, 1fr))` }}
              >
                <div />
                {informe.etapas.map((e) => (
                  <div key={e.clave} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-textoTenue">
                    {e.corto}
                  </div>
                ))}
                {informe.matriz.map((f) => (
                  <Fragmento key={f.plataforma}>
                    <div className={`flex items-center text-sm font-semibold ${COLOR_PLATAFORMA[f.plataforma]}`}>
                      {f.nombre}
                    </div>
                    {f.celdas.map((c, i) => (
                      <CeldaMatriz key={informe.etapas[i].clave} c={c} />
                    ))}
                  </Fragmento>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-textoTenue">
            Cada columna es un peldaño del embudo de {informe.negocioNombre.toLowerCase()}. Verde: la plataforma declara
            un evento para ese peldaño. Rojo: no encontramos ninguno en las URLs revisadas.
          </p>
        </Seccion>
      )}

      {/* ── Lo instalado ───────────────────────────────────────────────── */}
      <Seccion titulo="Lo que está instalado" icono={<Tag className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {informe.instalaciones.map((i) => (
            <div
              key={`${i.plataforma}-${i.tipo}-${i.id}`}
              className={`tarjeta evitar-corte p-4 ${i.duplicada ? 'border-criticoHondo' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-xs font-semibold uppercase tracking-widest ${COLOR_PLATAFORMA[i.plataforma]}`}>
                  {NOMBRE_PLATAFORMA[i.plataforma]}
                </span>
                {i.duplicada && (
                  <span className="rounded bg-criticoFondo px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-critico">
                    duplicado
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-textoSuave">{NOMBRE_TIPO[i.tipo]}</p>
              <p className="cifra mt-1 break-all text-base text-texto">{i.id}</p>
              <p className="mt-2 text-xs text-textoTenue">
                Visto en {i.paginas.map((n) => informe.paginas[n]?.etiqueta || `página ${n + 1}`).join(', ')} ·{' '}
                {i.vias.join(', ')}
              </p>
            </div>
          ))}
          {!informe.instalaciones.length && (
            <p className="tarjeta p-4 text-sm text-textoSuave">
              No apareció ningún identificador de medición en el código servido.
            </p>
          )}
        </div>

        {!!conGtm.length && (
          <div className="mt-4 space-y-3">
            {conGtm.map((c) => (
              <div key={c.id} className="tarjeta evitar-corte p-4">
                <p className="text-sm">
                  Dentro del contenedor <span className="cifra text-texto">{c.id}</span> hay{' '}
                  <span className="cifra">{c.total}</span> etiquetas:
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.etiquetas?.map((e) => (
                    <li
                      key={e.clave}
                      className="rounded-full border border-borde px-2.5 py-1 text-xs text-textoSuave"
                    >
                      {e.nombre} <span className="cifra text-textoTenue">×{e.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* ── Eventos ────────────────────────────────────────────────────── */}
      {!!informe.eventos.length && (
        <Seccion titulo="Eventos declarados" icono={<FileText className="h-5 w-5" />}>
          <div className="tarjeta overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-borde text-[11px] uppercase tracking-wider text-textoTenue">
                  <th className="px-4 py-3 font-semibold">Plataforma</th>
                  <th className="px-4 py-3 font-semibold">Evento</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Dónde se declara</th>
                </tr>
              </thead>
              <tbody>
                {informe.eventos.map((e) => (
                  <tr key={`${e.plataforma}-${e.nombre}`} className="border-b border-borde last:border-0">
                    <td className={`px-4 py-3 font-semibold ${COLOR_PLATAFORMA[e.plataforma]}`}>
                      {NOMBRE_PLATAFORMA[e.plataforma]}
                    </td>
                    <td className="cifra px-4 py-3 text-texto">{e.nombre}</td>
                    <td className="px-4 py-3">
                      {e.plataforma === 'linkedin' ? (
                        <span className="text-textoTenue">sin nombre</span>
                      ) : e.estandar ? (
                        <span className="text-senal">estándar</span>
                      ) : (
                        <span className="text-aviso">personalizado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-textoSuave">
                      {e.paginas.length
                        ? e.paginas.map((n) => informe.paginas[n]?.etiqueta || `página ${n + 1}`).join(', ')
                        : e.origenes.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      {/* ── Cobertura ──────────────────────────────────────────────────── */}
      <Seccion titulo="Qué se pudo comprobar y qué no" icono={<ShieldQuestion className="h-5 w-5" />}>
        <div className="tarjeta evitar-corte p-5">
          <ul className="space-y-2 text-sm text-textoSuave">
            {informe.paginas.map((p) => (
              <li key={p.url} className="flex gap-2">
                <span className={p.ok ? 'text-senal' : 'text-critico'} aria-hidden>
                  {p.ok ? '✓' : '✕'}
                </span>
                <span className="min-w-0 break-words">
                  <span className="text-texto">{p.etiqueta}:</span>{' '}
                  <span className="cifra text-xs">{p.urlFinal || p.url}</span>
                  {!p.ok && <span className="block text-critico">{p.motivo}</span>}
                </span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 border-t border-borde pt-4 text-sm text-textoSuave">
            {informe.cobertura.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-textoTenue" aria-hidden>
                  ·
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </Seccion>
    </div>
  )
}

// React no deja poner una `key` en un fragmento con la sintaxis corta.
function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function nombreDeSitio(informe: TInforme) {
  const primera = informe.paginas.find((p) => p.ok) || informe.paginas[0]
  if (!primera) return 'Sitio sin identificar'
  try {
    return new URL(primera.urlFinal || primera.url).hostname.replace(/^www\./, '')
  } catch {
    return primera.url
  }
}
