import { expect, test } from '@playwright/test'
import { collectErrors, connectDropbox, newDropbox, onboard, useFakeDropbox } from './helpers'

test('Widget-Schlüssel kopieren: enthält App-Schlüssel, Refresh-Token und Pfad der Fortschrittsdatei', async ({ browser }) => {
  const context = await browser.newContext()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const box = newDropbox()
  await useFakeDropbox(context, box)
  const page = await context.newPage()
  const errors = collectErrors(page)
  await onboard(page)
  await connectDropbox(page)
  expect(box.files.has('/fortschritt.json')).toBe(true)

  await page.getByText('Widget-Schlüssel (Scriptable)').click()
  await page.getByRole('button', { name: 'Widget-Schlüssel kopieren' }).click()
  await expect(page.getByRole('button', { name: 'Widget-Schlüssel kopiert' })).toBeVisible()
  const key: string = await page.evaluate(() => navigator.clipboard.readText())
  expect(key.startsWith('lernapp-widget:')).toBe(true)
  const decoded = JSON.parse(Buffer.from(key.slice('lernapp-widget:'.length), 'base64').toString())
  expect(decoded).toMatchObject({ r: 'r', p: '/Fortschritt.json' })
  expect(decoded.k).toBeTruthy()
  expect(errors).toEqual([])
})
