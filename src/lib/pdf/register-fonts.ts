import { Font } from '@react-pdf/renderer'

/**
 * Canonical font-family names — use these constants everywhere.
 * @react-pdf matches family strings exactly (whitespace + case sensitive),
 * so a single source of truth prevents "font not registered" drift.
 */
export const FONTS = {
  body: 'DMSans',
  script: 'GreatVibes',
  display: 'ArchivoBlack',
} as const

let registered = false

/** Idempotent synchronous registration. Safe to call multiple times. */
export function registerPdfFonts(): void {
  if (registered) return

  Font.register({
    family: FONTS.body,
    fonts: [
      { src: '/fonts/dm-sans-400.woff', fontWeight: 400 },
      { src: '/fonts/dm-sans-700.woff', fontWeight: 700 },
    ],
  })

  Font.register({
    family: FONTS.script,
    src: '/fonts/GreatVibes-Regular.ttf',
  })

  Font.register({
    family: FONTS.display,
    src: '/fonts/ArchivoBlack-Regular.ttf',
  })

  // Disable hyphenation — @react-pdf's default can split words awkwardly
  Font.registerHyphenationCallback(word => [word])

  registered = true
}

// Register immediately at module load. Any file that imports from this
// module triggers registration before the PDFViewer / pdf() sees a component.
registerPdfFonts()
