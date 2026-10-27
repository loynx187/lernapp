// Erzeugt die PNG-Icons aus public/icon.svg (benötigt Playwright/Chromium).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// Playwright ist im Container global installiert, nicht als Projektabhängigkeit.
const { chromium } = createRequire(import.meta.url)('playwright')

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: false })
}
await browser.close()
