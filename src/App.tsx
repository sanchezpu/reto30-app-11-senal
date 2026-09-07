import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'
import type { Informe as TInforme, Negocio } from './tipos'
import { analizar } from './api'
import { enlaceAInforme } from './compartir'
import { DEMO } from './demo'
import Informe from './Informe'

const CAMPOS = [
  {
    clave: 'portada',
    etiqueta: 'Portada',
    ejemplo: 'tutienda.com',
    ayuda: 'Donde vive el código base de casi todos los píxeles.',
    obligatorio: true,
  },
  {
    clave: 'producto',
    etiqueta: 'Página de producto o servicio',
    ejemplo: 'tutienda.com/producto/lo-que-vendes',
    ayuda: 'Aquí es donde suelen declararse ViewContent y AddToCart.',
    obligatorio: false,
  },
  {
    clave: 'gracias',
    etiqueta: 'Página de gracias o confirmación',
    ejemplo: 'tutienda.com/gracias',
    ayuda: 'La más importante: el evento de compra o de lead casi siempre vive aquí y en ningún otro sitio.',
    obligatorio: false,
  },
] as const

const NEGOCIOS: { clave: Negocio; nombre: string; pista: string }[] = [
  { clave: 'ecommerce', nombre: 'Tienda online', pista: 'Vendes productos y cobras en la web' },
  { clave: 'leads', nombre: 'Generación de leads', pista: 'Captas contactos con un formulario' },
  { clave: 'reservas', nombre: 'Reservas y citas', pista: 'La gente reserva una fecha o una hora' },
]

const PASOS = [
  'Descargando las páginas…',
  'Buscando píxeles de Meta, Google, TikTok y LinkedIn…',
  'Abriendo el contenedor de Tag Manager…',
  'Cruzando eventos con el embudo de tu negocio…',
]

export default function App() {
  const [urls, setUrls] = useState(['', '', ''])
  const [negocio, setNegocio] = useState<Negocio>('ecommerce')
  const [cargando, setCargando] = useState(false)
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [informe, setInforme] = useState<TInforme | null>(null)

  // Un informe compartido llega entero dentro del enlace: no hay nada que
  // consultar en ningún servidor.
  const compartido = useMemo(() => enlaceAInforme(location.hash), [])
  useEffect(() => {
    if (compartido) setInforme(compartido)
  }, [compartido])

  useEffect(() => {
    if (!cargando) return
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 3500)
    return () => clearInterval(t)
  }, [cargando])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!urls[0].trim()) return setError('Necesitamos al menos la portada del sitio.')
    setError('')
    setPaso(0)
    setCargando(true)
    try {
      const resultado = await analizar(urls, negocio)
      history.replaceState(null, '', location.pathname)
      setInforme(resultado)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
    } finally {
      setCargando(false)
    }
  }

  function reiniciar() {
    setInforme(null)
    setUrls(['', '', ''])
    history.replaceState(null, '', location.pathname)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  return (
    <div className="min-h-screen">
      <header className="no-imprimir border-b border-borde">
        <div className="medida flex h-16 items-center gap-2">
          <Activity className="h-5 w-5 text-senal" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Señal</span>
          <span className="ml-auto hidden text-sm text-textoTenue sm:block">
            Auditoría de píxeles y eventos de conversión
          </span>
        </div>
      </header>

      {informe ? (
        <>
          <Informe informe={informe} alReiniciar={reiniciar} />
          {compartido && informe === compartido && (
            <div className="no-imprimir medida pb-16">
              <button
                onClick={reiniciar}
                className="inline-flex items-center gap-2 rounded-lg bg-senal px-5 py-2.5 text-sm font-semibold text-fondo hover:bg-senal/90"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Analizar mi sitio
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="no-imprimir">
            <section
              className="border-b border-borde py-14 sm:py-20"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(74, 222, 128, 0.10) 1px, transparent 1px), radial-gradient(rgba(74, 222, 128, 0.06) 1px, transparent 1px)',
                backgroundSize: '22px 22px, 22px 22px',
                backgroundPosition: '0 0, 11px 11px',
              }}
            >
              <div className="medida">
                <p className="text-xs font-semibold uppercase tracking-widest text-senal">
                  Sin cuentas, sin instalar nada
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                  ¿Tus campañas miden lo que crees que miden?
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-textoSuave sm:text-lg">
                  Pega hasta tres direcciones de tu sitio y te decimos qué píxeles están puestos, qué eventos declaran
                  de verdad y qué falta. Con el fallo que más dinero cuesta y que casi nadie ve: el mismo píxel
                  cargándose dos veces.
                </p>
              </div>
            </section>

            <form onSubmit={enviar} className="medida -mt-6 sm:-mt-8">
              <div className="tarjeta bg-panel p-5 shadow-2xl shadow-black/40 sm:p-7">
                <div className="grid grid-cols-1 gap-4">
                  {CAMPOS.map((c, i) => (
                    <div key={c.clave} className="grid grid-cols-1">
                      <label htmlFor={c.clave} className="text-sm font-semibold">
                        {c.etiqueta}
                        {!c.obligatorio && <span className="ml-2 text-xs font-normal text-textoTenue">opcional</span>}
                      </label>
                      <p className="mt-0.5 text-xs text-textoTenue">{c.ayuda}</p>
                      <input
                        id={c.clave}
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={c.ejemplo}
                        value={urls[i]}
                        onChange={(e) => setUrls((u) => u.map((v, n) => (n === i ? e.target.value : v)))}
                        className="cifra mt-2 w-full rounded-lg border border-borde bg-fondo px-3.5 py-3 text-sm text-texto placeholder:text-textoTenue focus:border-senal focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold">¿Qué hace este negocio?</legend>
                  <p className="mt-0.5 text-xs text-textoTenue">
                    De esto depende qué eventos deberían existir. Un embudo de tienda no es el de una consulta.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {NEGOCIOS.map((n) => (
                      <label
                        key={n.clave}
                        className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                          negocio === n.clave
                            ? 'border-senal bg-senalFondo'
                            : 'border-borde bg-fondo hover:border-bordeVivo'
                        }`}
                      >
                        <input
                          type="radio"
                          name="negocio"
                          value={n.clave}
                          checked={negocio === n.clave}
                          onChange={() => setNegocio(n.clave)}
                          className="sr-only"
                        />
                        <span className={`block text-sm font-semibold ${negocio === n.clave ? 'text-senal' : ''}`}>
                          {n.nombre}
                        </span>
                        <span className="mt-0.5 block text-xs text-textoTenue">{n.pista}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 grid grid-cols-1">
                  <button
                    type="submit"
                    disabled={cargando}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-senal px-6 py-3.5 text-base font-semibold text-fondo transition-colors hover:bg-senal/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cargando ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Analizando…
                      </>
                    ) : (
                      <>
                        Analizar la medición <ArrowRight className="h-5 w-5" aria-hidden />
                      </>
                    )}
                  </button>
                </div>

                {cargando && (
                  <p className="mt-3 text-center text-sm text-textoSuave" aria-live="polite">
                    {PASOS[paso]}
                  </p>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-criticoHondo bg-criticoFondo px-3.5 py-3 text-sm text-critico"
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}

                <p className="mt-4 text-xs leading-relaxed text-textoTenue">
                  Leemos el código que tu servidor manda al navegador y el contenedor público de Tag Manager. No
                  abrimos un navegador ni hacemos clic en nada, así que lo que solo existe al pulsar un botón no
                  aparece aquí. El informe dice siempre qué se pudo comprobar y qué no.
                </p>
              </div>
            </form>

            <div className="medida mt-14">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde pb-3">
                <h2 className="text-lg font-semibold">Así se ve un informe</h2>
                <p className="text-sm text-textoTenue">
                  Ejemplo de una tienda con los tres fallos más comunes
                </p>
              </div>
            </div>
          </div>

          <Informe informe={DEMO} />
        </>
      )}

      <footer className="no-imprimir border-t border-borde py-8">
        <div className="medida flex flex-wrap items-center justify-between gap-3 text-sm text-textoTenue">
          <span>
            <span className="font-semibold text-textoSuave">Señal</span> · Lo que tu web le está contando de verdad a
            cada plataforma
          </span>
          <span>5 análisis por hora</span>
        </div>
      </footer>
    </div>
  )
}
