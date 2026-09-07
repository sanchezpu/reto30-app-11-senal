export type Plataforma = 'meta' | 'google' | 'tiktok' | 'linkedin'
export type Negocio = 'ecommerce' | 'leads' | 'reservas'
export type Gravedad = 'critico' | 'aviso' | 'bien'
export type EstadoCelda = 'si' | 'no' | 'sinnombre' | 'nomedible'

export interface Pagina {
  url: string
  urlFinal?: string
  etiqueta: string
  ok: boolean
  motivo?: string
  bytes?: number
  cortada?: boolean
}

export interface Contenedor {
  id: string
  ok: boolean
  motivo?: string
  bytes?: number
  total?: number
  /** Etiquetas que declaran un evento cuyo nombre viene de una variable y no
   *  se puede leer desde fuera. Se declara en la cobertura del informe. */
  opacas?: number
  etiquetas?: { clave: string; nombre: string; n: number }[]
}

export interface Instalacion {
  plataforma: Plataforma
  tipo: 'pixel' | 'ga4' | 'gtm' | 'ads' | 'ua' | 'insight'
  id: string
  paginas: number[]
  vias: string[]
  duplicada: { pagina: number; fuentes: string[] } | null
}

export interface Evento {
  plataforma: Plataforma
  nombre: string
  estandar: boolean
  paginas: number[]
  origenes: string[]
}

export interface Celda {
  estado: EstadoCelda
  evento: string
}

export interface Fila {
  plataforma: Plataforma
  nombre: string
  celdas: Celda[]
}

export interface Etapa {
  clave: string
  nombre: string
  corto: string
  conversion: boolean
}

export interface Hallazgo {
  id: string
  gravedad: Gravedad
  titulo: string
  que: string
  porque: string
  hacer: string
  detalle?: string[]
}

export interface Area {
  clave: string
  nombre: string
  peso: number
  medida: boolean
  nota: number
}

export interface Informe {
  generado: string
  negocio: Negocio
  negocioNombre: string
  paginas: Pagina[]
  contenedores: Contenedor[]
  instalaciones: Instalacion[]
  eventos: Evento[]
  etapas: Etapa[]
  matriz: Fila[]
  hallazgos: Hallazgo[]
  areas: Area[]
  nota: number
  sobre: number
  cobertura: string[]
  /** Solo el informe de ejemplo que la app enseña al abrirse. */
  ejemplo?: boolean
  sitio?: string
}
