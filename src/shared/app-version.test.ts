import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './app-version'

describe('app-version', () => {
  it('matches package.json version', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe(APP_VERSION)
  })
})
