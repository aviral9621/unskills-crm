let fontsRegistered = false

export async function registerPdfFonts(): Promise<void> {
  if (fontsRegistered) return
  const { Font } = await import('@react-pdf/renderer')
  Font.register({
    family: 'DMSans',
    fonts: [
      { src: '/fonts/dm-sans-400.woff', fontWeight: 400 },
      { src: '/fonts/dm-sans-700.woff', fontWeight: 700 },
    ],
  })
  Font.register({
    family: 'GreatVibes',
    src: '/fonts/GreatVibes-Regular.ttf',
  })
  fontsRegistered = true
}
