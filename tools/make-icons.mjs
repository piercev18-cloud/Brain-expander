/**
 * Generate the app icons without an image dependency: a crescent in the accent
 * colour on the app's own surface. Written as raw PNG via zlib so the build has
 * no binary assets checked in that nobody can regenerate.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SURFACE = [0x14, 0x13, 0x11]
const ACCENT = [0xd9, 0x59, 0x26]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = c ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  const r = size * 0.30
  const cx = size * 0.46
  const cy = size * 0.47
  // A second, offset disc bites the crescent out of the first.
  const bx = size * 0.60
  const by = size * 0.38
  const br = size * 0.28

  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const inMoon = (x - cx) ** 2 + (y - cy) ** 2 <= r * r
      const inBite = (x - bx) ** 2 + (y - by) ** 2 <= br * br
      const color = inMoon && !inBite ? ACCENT : SURFACE
      raw[offset++] = color[0]
      raw[offset++] = color[1]
      raw[offset++] = color[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = join(import.meta.dirname, '..', 'public')
mkdirSync(out, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(out, `icon-${size}.png`), png(size))
}
writeFileSync(
  join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#141311"/><path d="M46 17a30 30 0 1 0 0 60 30 30 0 0 0 0-60zm14 4a28 28 0 1 1 0 0z" fill="#d95926"/><circle cx="46" cy="47" r="30" fill="#d95926"/><circle cx="60" cy="38" r="28" fill="#141311"/></svg>`,
)
console.log('icons written')
