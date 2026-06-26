import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicIconsDir = resolve(__dirname, '../public/icons')

mkdirSync(publicIconsDir, { recursive: true })

function hexToRgba(hex, alpha = 255) {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    alpha,
  ]
}

function mix(left, right, t) {
  return left + (right - left) * t
}

function createImage(size, background) {
  const pixels = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      pixels[offset] = background[0]
      pixels[offset + 1] = background[1]
      pixels[offset + 2] = background[2]
      pixels[offset + 3] = background[3]
    }
  }

  return pixels
}

function setPixel(pixels, size, x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return
  }

  const offset = (Math.floor(y) * size + Math.floor(x)) * 4
  const alpha = rgba[3] / 255
  const inverseAlpha = 1 - alpha

  pixels[offset] = Math.round(rgba[0] * alpha + pixels[offset] * inverseAlpha)
  pixels[offset + 1] = Math.round(rgba[1] * alpha + pixels[offset + 1] * inverseAlpha)
  pixels[offset + 2] = Math.round(rgba[2] * alpha + pixels[offset + 2] * inverseAlpha)
  pixels[offset + 3] = Math.round((alpha + (pixels[offset + 3] / 255) * inverseAlpha) * 255)
}

function fillRect(pixels, size, left, top, width, height, color) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      setPixel(pixels, size, x, y, color)
    }
  }
}

function fillCircle(pixels, size, cx, cy, radius, color) {
  const radiusSquared = radius * radius

  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx
      const dy = y - cy

      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(pixels, size, x, y, color)
      }
    }
  }
}

function fillRoundedRect(pixels, size, left, top, width, height, radius, color) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const nearestX = Math.max(left + radius, Math.min(x, left + width - radius - 1))
      const nearestY = Math.max(top + radius, Math.min(y, top + height - radius - 1))
      const dx = x - nearestX
      const dy = y - nearestY

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, size, x, y, color)
      }
    }
  }
}

function fillRotatedRoundedRect(pixels, size, centerX, centerY, width, height, radius, angle, topColor, bottomColor) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const halfWidth = width / 2
  const halfHeight = height / 2

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - centerX
      const dy = y - centerY
      const localX = dx * cos + dy * sin
      const localY = -dx * sin + dy * cos
      const nearestX = Math.max(-halfWidth + radius, Math.min(localX, halfWidth - radius))
      const nearestY = Math.max(-halfHeight + radius, Math.min(localY, halfHeight - radius))
      const deltaX = localX - nearestX
      const deltaY = localY - nearestY

      if (deltaX * deltaX + deltaY * deltaY <= radius * radius) {
        const blend = (localY + halfHeight) / height
        const color = [
          Math.round(mix(topColor[0], bottomColor[0], blend)),
          Math.round(mix(topColor[1], bottomColor[1], blend)),
          Math.round(mix(topColor[2], bottomColor[2], blend)),
          Math.round(mix(topColor[3], bottomColor[3], blend)),
        ]
        setPixel(pixels, size, x, y, color)
      }
    }
  }
}

function fillTriangle(pixels, size, pointA, pointB, pointC, color) {
  const minX = Math.floor(Math.min(pointA[0], pointB[0], pointC[0]))
  const maxX = Math.ceil(Math.max(pointA[0], pointB[0], pointC[0]))
  const minY = Math.floor(Math.min(pointA[1], pointB[1], pointC[1]))
  const maxY = Math.ceil(Math.max(pointA[1], pointB[1], pointC[1]))

  function sign(point1, point2, point3) {
    return (point1[0] - point3[0]) * (point2[1] - point3[1]) - (point2[0] - point3[0]) * (point1[1] - point3[1])
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const point = [x, y]
      const d1 = sign(point, pointA, pointB)
      const d2 = sign(point, pointB, pointC)
      const d3 = sign(point, pointC, pointA)
      const hasNegative = d1 < 0 || d2 < 0 || d3 < 0
      const hasPositive = d1 > 0 || d2 > 0 || d3 > 0

      if (!(hasNegative && hasPositive)) {
        setPixel(pixels, size, x, y, color)
      }
    }
  }
}

function addGlow(pixels, size, centerX, centerY, radius, color) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= radius) {
        const strength = 1 - distance / radius
        setPixel(pixels, size, x, y, [color[0], color[1], color[2], Math.round(color[3] * strength * 0.7)])
      }
    }
  }
}

function drawSpade(pixels, size, centerX, centerY, scale, color) {
  fillCircle(pixels, size, centerX - scale * 0.22, centerY - scale * 0.02, scale * 0.2, color)
  fillCircle(pixels, size, centerX + scale * 0.22, centerY - scale * 0.02, scale * 0.2, color)
  fillTriangle(
    pixels,
    size,
    [centerX, centerY - scale * 0.46],
    [centerX - scale * 0.32, centerY + scale * 0.12],
    [centerX + scale * 0.32, centerY + scale * 0.12],
    color,
  )
  fillRect(pixels, size, centerX - scale * 0.06, centerY + scale * 0.1, scale * 0.12, scale * 0.26, color)
  fillTriangle(
    pixels,
    size,
    [centerX - scale * 0.18, centerY + scale * 0.34],
    [centerX + scale * 0.18, centerY + scale * 0.34],
    [centerX, centerY + scale * 0.18],
    color,
  )
}

function crc32(buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc ^= byte

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

function encodePng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    pixels.subarray(y * stride, (y + 1) * stride).forEach((value, index) => {
      raw[rowStart + 1 + index] = value
    })
  }

  const idat = deflateSync(raw)
  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', Buffer.alloc(0)),
  ])
}

function buildIcon(size) {
  const pixels = createImage(size, hexToRgba('#140f1e'))
  addGlow(pixels, size, size * 0.5, size * 0.34, size * 0.4, hexToRgba('#7c3aed', 220))
  fillRoundedRect(pixels, size, size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.2, hexToRgba('#120d1d'))
  fillRotatedRoundedRect(
    pixels,
    size,
    size * 0.5,
    size * 0.52,
    size * 0.52,
    size * 0.52,
    size * 0.11,
    -0.14,
    hexToRgba('#fff8ea'),
    hexToRgba('#eadfc7'),
  )
  fillRotatedRoundedRect(
    pixels,
    size,
    size * 0.5,
    size * 0.52,
    size * 0.58,
    size * 0.58,
    size * 0.13,
    -0.14,
    hexToRgba('#facc15', 190),
    hexToRgba('#f59e0b', 190),
  )
  fillRotatedRoundedRect(
    pixels,
    size,
    size * 0.5,
    size * 0.52,
    size * 0.52,
    size * 0.52,
    size * 0.11,
    -0.14,
    hexToRgba('#fff8ea'),
    hexToRgba('#eadfc7'),
  )
  drawSpade(pixels, size, size * 0.5, size * 0.5, size * 0.32, hexToRgba('#241437'))
  return encodePng(size, pixels)
}

writeFileSync(resolve(publicIconsDir, 'icon-192.png'), buildIcon(192))
writeFileSync(resolve(publicIconsDir, 'icon-512.png'), buildIcon(512))
writeFileSync(resolve(publicIconsDir, 'apple-touch-icon.png'), buildIcon(180))
