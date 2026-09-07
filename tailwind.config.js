/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sala de control: la app mide señales, así que se ve como un monitor.
        // Fondo oscuro en pantalla y hoja blanca al imprimir (ver index.css).
        fondo: '#0B0F14',
        panel: '#121821',
        panelAlto: '#18202B',
        borde: '#243040',
        bordeVivo: '#33455C',
        // Textos SOLIDOS, nunca opacidades: una opacidad cómoda de escribir se
        // cae por debajo del 4.5:1 de WCAG AA sobre este fondo.
        texto: '#E7EDF5',
        textoSuave: '#AEBACB',
        textoTenue: '#8B99AC',
        // Verde señal: el acento. Dos tonos, uno para fondo oscuro y otro
        // legible sobre superficies claras (el informe impreso).
        senal: '#4ADE80',
        senalHondo: '#15803D',
        senalFondo: '#0E2A1B',
        // Semáforo del diagnóstico.
        critico: '#FB7185',
        criticoHondo: '#9F1239',
        criticoFondo: '#2B1119',
        aviso: '#FBBF24',
        avisoHondo: '#92400E',
        avisoFondo: '#2A1F0B',
        // Cada plataforma con su color, para leer la matriz de un vistazo.
        meta: '#60A5FA',
        google: '#FCD34D',
        tiktok: '#5EEAD4',
        linkedin: '#93C5FD',
      },
      fontFamily: {
        // Sin fuentes web a propósito: una petición menos y el primer pintado
        // llega antes. La mono lleva el peso: el tema son IDs y eventos.
        cuerpo: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
