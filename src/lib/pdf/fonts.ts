// Re-export the canonical font registration module. Historical call-sites
// imported `registerPdfFonts` from here; keep that working while new code
// imports from './register-fonts' for the FONTS constants too.
export { registerPdfFonts, FONTS } from './register-fonts'
