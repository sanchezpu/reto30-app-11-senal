import type { Informe, Negocio } from './tipos'

export async function analizar(urls: string[], negocio: Negocio): Promise<Informe> {
  let res: Response
  try {
    res = await fetch('/api/analizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls, negocio }),
    })
  } catch {
    throw new Error('No hay conexión con el servidor. Comprueba tu red y vuelve a intentarlo.')
  }
  let datos: unknown = null
  try {
    datos = await res.json()
  } catch {
    // Un cuerpo ilegible casi siempre es la página de error del proxy, no
    // nuestra API. El mensaje genérico es lo único honesto que se puede decir.
  }
  const cuerpo = datos as { error?: string } | null
  if (!res.ok) {
    throw new Error(cuerpo?.error || 'No pudimos completar el análisis. Inténtalo de nuevo en un momento.')
  }
  return cuerpo as unknown as Informe
}
