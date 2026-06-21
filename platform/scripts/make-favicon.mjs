import sharp from "sharp"
import { readFileSync, writeFileSync } from "node:fs"

const src = "public/heysalad-launcher.jpg"

// Load raw RGBA pixels
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height, channels } = info

// Make near-white pixels transparent
const threshold = 238
for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  if (r >= threshold && g >= threshold && b >= threshold) {
    data[i + 3] = 0
  }
}

const png = await sharp(data, { raw: { width, height, channels } })
  .png()
  .toBuffer()

writeFileSync("public/heysalad-icon.png", png)
console.log("[v0] wrote public/heysalad-icon.png", png.length, "bytes")
