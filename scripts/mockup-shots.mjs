// Zrzuty makiet z docs/design/mockups do test-results/mockups/<Nazwa>.png.
// Użycie: pnpm mockups:shots [Nazwa ...]   (bez argumentów: wszystkie makiety)
// Pliki M* i CM* (telefon) w 390×844, pozostałe w 1440×900.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { chromium } from '@playwright/test'

const ROOT = join(process.cwd(), 'docs/design/mockups')
const OUT = join(process.cwd(), 'test-results/mockups')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }

const all = readdirSync(ROOT).filter((f) => f.endsWith('.dc.html')).map((f) => f.replace('.dc.html', ''))
const names = process.argv.length > 2 ? process.argv.slice(2) : all
const unknown = names.filter((n) => !all.includes(n))
if (unknown.length) {
  console.error(`Nie ma takich makiet: ${unknown.join(', ')}`)
  process.exit(1)
}

// Prosty serwer statyczny na losowym porcie.
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = join(ROOT, path)
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

// Lokalnie (bez CI) można użyć systemowego Chrome: PW_CHANNEL=chrome.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
mkdirSync(OUT, { recursive: true })
try {
  for (const name of names) {
    const isPhone = /^C?M[A-Z]/.test(name)
    const page = await browser.newPage({
      viewport: isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: isPhone ? 2 : 1,
    })
    await page.goto(`http://127.0.0.1:${port}/${name}.dc.html`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })
    await page.close()
    console.log(`✓ ${name}`)
  }
} finally {
  await browser.close()
  server.close()
}
