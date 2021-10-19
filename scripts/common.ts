import fs from 'fs'
import { fileURLToPath } from 'url'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const INTERNAL_PACKAGE_PREFIX = '.'

export const ROOT_PATH = path.resolve(__dirname, '..')

export const PACKAGES_PATH = path.resolve(ROOT_PATH, 'packages')

export const PACKAGES = fs
  .readdirSync(PACKAGES_PATH)
  .filter((packageName) => !packageName.startsWith(INTERNAL_PACKAGE_PREFIX))

export const PACKAGES_PATHS = PACKAGES.map((packageName) =>
  path.resolve(PACKAGES_PATH, packageName),
)

const invalid = Symbol()
export function cached<T extends (...a: any[]) => any>(
  fn: T,
): T & { invalidate: T } {
  let cache = invalid

  const invalidate = (...a: any[]) => (cache = fn(...a))

  return Object.assign(
    (...a: any[]) => (cache === invalid ? invalidate(...a) : cache),
    { invalidate },
  ) as any
}
