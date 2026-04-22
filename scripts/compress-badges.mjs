// Downscale certification badge PNGs to 200px max dimension so they don't
// bloat every issued certificate. Badges render at ~20pt (~28px at 130 DPI)
// so 200px source is more than enough.
import { readFile, writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const FILES = [
  'public/ISO LOGOs.png',
  'public/MSME loogo.png',
  'public/Skill India Logo.png',
  'public/NSDC logo.png',
  'public/Digital India logo.png',
  'public/ANSI logo.png',
  'public/IAF LOGO.png',
]

const MAX = 200

for (const f of FILES) {
  const buf = await readFile(f)
  const img = await loadImage(buf)
  const s = Math.min(MAX / img.width, MAX / img.height, 1)
  const w = Math.max(1, Math.round(img.width * s))
  const h = Math.max(1, Math.round(img.height * s))
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const out = await canvas.encode('png')
  await writeFile(f, out)
  console.log(`${f}: ${(buf.byteLength/1024).toFixed(0)} KB (${img.width}x${img.height}) -> ${(out.byteLength/1024).toFixed(0)} KB (${w}x${h})`)
}
