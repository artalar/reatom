import type { Plugin } from 'vite'

import { isTransformTarget, transformReatomModule } from './transform.ts'

export type ReatomViteOptions = {
  /**
   * Inject route HMR cleanup for `reatomRoute` / `.reatomRoute()` calls.
   *
   * @default true
   */
  routes?: boolean
  /**
   * Inject JSX mount HMR cleanup for `mount()` from `@reatom/jsx`.
   *
   * @default true
   */
  jsx?: boolean
  /**
   * Additional picomatch patterns to include. Defaults to JS/TS modules outside
   * `node_modules`.
   */
  include?: string | RegExp | Array<string | RegExp>
  /** Picomatch patterns to exclude from the transform. */
  exclude?: string | RegExp | Array<string | RegExp>
}

const matchesPattern = (
  id: string,
  pattern: string | RegExp | Array<string | RegExp> | undefined,
  fallback: boolean,
): boolean => {
  if (pattern == null) return fallback
  const patterns = Array.isArray(pattern) ? pattern : [pattern]
  return patterns.some((entry) =>
    typeof entry === 'string' ? id.includes(entry) : entry.test(id),
  )
}

/**
 * Vite plugin that wires Reatom routing and `@reatom/jsx` mount hot updates.
 *
 * Child routes register on a plain `routes` object; without cleanup a hot
 * update can leave a stale parent `outlet`. JSX `mount()` trees also need
 * `unmount()` before the module re-runs. This plugin injects that dispose logic
 * automatically in development.
 *
 * @example
 *   import { defineConfig } from 'vite'
 *   import { reatom } from '@reatom/vite'
 *
 *   export default defineConfig({
 *     plugins: [reatom()],
 *   })
 */
export const reatom = (options: ReatomViteOptions = {}): Plugin => {
  const routes = options.routes !== false
  const jsx = options.jsx !== false

  return {
    name: '@reatom/vite',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      if (!isTransformTarget(id)) return null
      if (!matchesPattern(id, options.include, true)) return null
      if (matchesPattern(id, options.exclude, false)) return null

      const filename = id.split('?', 1)[0] ?? id
      const result = transformReatomModule(code, {
        routes,
        jsx,
        filename,
      })

      if (!result) return null

      return {
        code: result.code,
        map: result.map,
      }
    },
  }
}
