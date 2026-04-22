// Rasterize each cert template PDF to a JPG at 150 DPI using @napi-rs/canvas
// (prebuilt, no native compile needed) + pdfjs-dist. Writes a .jpg next to the
// source PDF. The cert generator swaps template embedding to image embedding.
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createCanvas, loadImage, GlobalFonts, Image } from '@napi-rs/canvas'

// Provide an ImageData-compatible factory for pdfjs.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const DIR = 'public/certificates'
const DPI = 130
const SCALE = DPI / 72
const JPG_QUALITY = 78

// pdfjs needs a CanvasFactory compatible with node. @napi-rs/canvas canvases
// support drawImage of Image objects, which is what pdfjs inline image
// painting ultimately needs.
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height)
    return { canvas, context: canvas.getContext('2d') }
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.pdf'))
let before = 0, after = 0

for (const file of files) {
  const src = `${DIR}/${file}`
  const out = src.replace(/\.pdf$/i, '.jpg')
  const buf = new Uint8Array(await readFile(src))
  before += buf.byteLength
  const doc = await pdfjs.getDocument({
    data: buf,
    disableFontFace: false,
    useSystemFonts: true,
    canvasFactory: new NodeCanvasFactory(),
  }).promise
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: SCALE })
  const factory = new NodeCanvasFactory()
  const { canvas, context } = factory.create(Math.ceil(vp.width), Math.ceil(vp.height))
  // white background so transparency doesn't bleed black
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport: vp, canvasFactory: factory }).promise
  const jpg = await canvas.encode('jpeg', JPG_QUALITY)
  await writeFile(out, jpg)
  after += jpg.byteLength
  await doc.destroy()
  console.log(`${file}: ${(buf.byteLength/1024).toFixed(0)} KB -> ${out.split('/').pop()} ${(jpg.byteLength/1024).toFixed(0)} KB`)
}
console.log(`TOTAL: ${(before/1024).toFixed(0)} KB PDFs -> ${(after/1024).toFixed(0)} KB JPGs`)
