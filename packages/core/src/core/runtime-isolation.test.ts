import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execPath } from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterAll, afterEach, beforeAll, expect, test } from 'test'
import { build } from 'tsdown'

import { VERSION } from './globalStore'

type Format = 'cjs' | 'esm'
type RuntimeFixture = {
  format: Format
  path: string
  url: string
}

const childTimeout = 15_000
const testTimeout = 20_000
const buildTimeout = 60_000
const coreRoot = fileURLToPath(new URL('../../', import.meta.url))
const tempDirs = new Set<string>()
let fixtureDir = ''
let esmBundle = ''
let cjsBundle = ''

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'reatom-runtime-isolation-build-'))

  try {
    await build({
      clean: true,
      cwd: coreRoot,
      deps: { neverBundle: ['idb-keyval'] },
      dts: false,
      entry: join(coreRoot, 'src/index.ts'),
      fixedExtension: false,
      format: {
        cjs: { target: ['node18'] },
        esm: { target: ['es2024'] },
      },
      logLevel: 'silent',
      outDir: fixtureDir,
      report: false,
      sourcemap: false,
    })
  } catch (error) {
    rmSync(fixtureDir, { force: true, recursive: true })
    throw new Error('runtime isolation fixture build failed', { cause: error })
  }

  esmBundle = join(fixtureDir, 'index.js')
  cjsBundle = join(fixtureDir, 'index.cjs')
  for (const bundle of [esmBundle, cjsBundle]) {
    if (!existsSync(bundle)) {
      throw new Error(`runtime isolation fixture is missing: ${bundle}`)
    }
  }
}, buildTimeout)

afterAll(() => {
  if (fixtureDir) rmSync(fixtureDir, { force: true, recursive: true })
})

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { force: true, recursive: true })
  tempDirs.clear()
})

function copyRuntime(
  format: Format,
  name: string,
  version = VERSION,
): RuntimeFixture {
  const source = format === 'esm' ? esmBundle : cjsBundle
  const bundle = readFileSync(source, 'utf8')

  if (version === VERSION) {
    return writeFixture(format, name, bundle)
  } else {
    const marker = JSON.stringify(VERSION)
    const markerCount = bundle.split(marker).length - 1
    expect(markerCount, 'runtime VERSION marker was not found').toBeGreaterThan(
      0,
    )
    const mutated = bundle.replaceAll(marker, JSON.stringify(version))
    expect(mutated.includes(marker), 'runtime VERSION marker remains').toBe(
      false,
    )
    return writeFixture(format, name, mutated)
  }
}

function writeFixture(format: Format, name: string, source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'reatom-runtime-isolation-'))
  tempDirs.add(dir)
  const path = join(dir, `${name}.${format === 'esm' ? 'mjs' : 'cjs'}`)
  writeFileSync(path, source)
  return { format, path, url: pathToFileURL(path).href }
}

function loadRuntime(name: string, fixture: RuntimeFixture) {
  return fixture.format === 'esm'
    ? `const ${name} = await import(${JSON.stringify(fixture.url)})`
    : `const ${name} = require(${JSON.stringify(fixture.path)})`
}

function smokeRuntime(runtime: string, name: string, value: number) {
  return `const ${name} = ${runtime}.atom(0, '${name}'); ${name}.set(${value}); if (${name}() !== ${value}) throw new Error('${name} smoke failed')`
}

function runChild(name: string, script: string) {
  const result = spawnSync(
    execPath,
    [
      '--input-type=module',
      '--eval',
      `let deferredError; process.once('uncaughtException', (error) => { deferredError ??= error }); process.once('unhandledRejection', (error) => { deferredError ??= error }); try { const { createRequire } = await import('node:module'); const require = createRequire(import.meta.url); ${script}; await Promise.resolve(); await new Promise((resolve) => setImmediate(resolve)); if (deferredError) throw deferredError; process.exit(0) } catch (error) { console.error(error); process.exit(1) }`,
    ],
    { encoding: 'utf8', timeout: childTimeout },
  )

  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(
      `${name}: child timed out after ${childTimeout}ms (signal: ${result.signal})`,
    )
  }
  if (result.signal !== null) {
    throw new Error(`${name}: child exited from signal ${result.signal}`)
  }
  if (result.error) {
    throw new Error(`${name}: child spawn failed: ${result.error.message}`)
  }

  expect(result.status, `${name}: ${result.stderr}`).toBe(0)
}

const runtimeKey = JSON.stringify(`@reatom/${VERSION}`)
const legacyBundle = `const VERSION = 'legacy'; let runtime = globalThis.__REATOM; if (runtime === undefined) { runtime = { version: VERSION, extensions: [] }; globalThis.__REATOM = runtime } else if (Array.isArray(runtime)) { runtime = { version: VERSION, extensions: runtime }; globalThis.__REATOM = runtime } if (runtime.version !== VERSION) throw new Error('legacy runtime collision'); const state = runtime.state ??= { value: 0 }; state.value++; export { runtime, state, VERSION }`

test(
  'keeps runtime helpers stable without claiming the legacy global',
  () => {
    const fixture = copyRuntime('esm', 'standalone')

    runChild(
      'standalone runtime',
      `delete globalThis.__REATOM; ${loadRuntime('runtime', fixture)}; const firstGlobal = runtime.ensureReatomGlobal(); const secondGlobal = runtime.ensureReatomGlobal(); if (firstGlobal !== secondGlobal || firstGlobal.version !== runtime.VERSION || firstGlobal.extensions !== runtime.EXTENSIONS) throw new Error('runtime helper contract changed'); const firstSlot = runtime._createGlobal('runtime-isolation.helper', () => ({ value: 1 })); const secondSlot = runtime._createGlobal('runtime-isolation.helper', () => ({ value: 2 })); if (firstSlot !== secondSlot || secondSlot.value !== 1) throw new Error('runtime slot contract changed'); if (Object.hasOwn(globalThis, '__REATOM')) throw new Error('__REATOM is claimed'); ${smokeRuntime('runtime', 'standaloneSmoke', 1)}`,
    )
  },
  testTimeout,
)

test.each([
  { legacyFirst: true, name: 'legacy before current' },
  { legacyFirst: false, name: 'current before legacy' },
])(
  'coexists when loaded $name',
  ({ legacyFirst }) => {
    const currentFixture = copyRuntime('esm', 'current-runtime')
    const legacyFixture = writeFixture('esm', 'legacy-runtime', legacyBundle)
    const loadCurrent = loadRuntime('runtime', currentFixture)
    const loadLegacy = loadRuntime('legacy', legacyFixture)
    const loadFirst = legacyFirst
      ? `${loadLegacy}; ${loadCurrent}`
      : `${loadCurrent}; ${loadLegacy}`

    runChild(
      legacyFirst ? 'legacy runtime first' : 'current runtime first',
      `delete globalThis.__REATOM; ${loadFirst}; ${smokeRuntime('runtime', 'legacyOrderSmoke', 1)}; if (globalThis.__REATOM !== legacy.runtime || legacy.state.value !== 1) throw new Error('legacy runtime changed')`,
    )
  },
  testTimeout,
)

test(
  'falls back locally when the symbol carrier is already occupied',
  () => {
    const fixture = copyRuntime('esm', 'occupied-carrier')

    runChild(
      'occupied symbol carrier',
      `delete globalThis.__REATOM; const key = Symbol.for(${runtimeKey}); const foreign = { owner: 'host' }; Object.defineProperty(globalThis, key, { value: foreign }); ${loadRuntime('runtime', fixture)}; const firstGlobal = runtime.ensureReatomGlobal(); const secondGlobal = runtime.ensureReatomGlobal(); if (firstGlobal === foreign || firstGlobal !== secondGlobal) throw new Error('local fallback is unstable'); if (Object.getOwnPropertyDescriptor(globalThis, key)?.value !== foreign) throw new Error('foreign carrier changed'); if (Object.hasOwn(globalThis, '__REATOM')) throw new Error('__REATOM is claimed'); ${smokeRuntime('runtime', 'occupiedCarrierSmoke', 1)}`,
    )
  },
  testTimeout,
)

test.each([
  { firstFormat: 'esm', name: 'two ESM copies', secondFormat: 'esm' },
  { firstFormat: 'esm', name: 'ESM and CJS copies', secondFormat: 'cjs' },
] satisfies Array<{
  firstFormat: Format
  name: string
  secondFormat: Format
}>)(
  'shares one runtime across compatible $name',
  ({ firstFormat, secondFormat }) => {
    const firstFixture = copyRuntime(firstFormat, 'compatible-first')
    const secondFixture = copyRuntime(secondFormat, 'compatible-second')

    runChild(
      `compatible ${firstFormat}/${secondFormat}`,
      `delete globalThis.__REATOM; ${loadRuntime('first', firstFixture)}; const state = first.atom(0, 'runtime-isolation.shared'); state.set(7); const count = first.context.count; ${loadRuntime('second', secondFixture)}; if (first.context !== second.context || first.STACK !== second.STACK || first.EXTENSIONS !== second.EXTENSIONS || second.context.count !== count || state() !== 7) throw new Error('compatible copies do not share one runtime'); const derived = second.computed(() => state() * 2, 'runtime-isolation.cross-copy'); let observed; const unsubscribe = derived.subscribe((value) => { observed = value }); state.set(8); await Promise.resolve(); if (derived() !== 16 || observed !== 16) throw new Error('cross-copy reactivity failed'); unsubscribe()`,
    )
  },
  testTimeout,
)

test.each([
  {
    firstFormat: 'esm',
    firstVersion: 'runtime-A',
    name: 'two ESM copies',
    secondFormat: 'esm',
    secondVersion: 'runtime-B',
  },
  {
    firstFormat: 'cjs',
    firstVersion: 'runtime-B',
    name: 'CJS before ESM',
    secondFormat: 'esm',
    secondVersion: 'runtime-A',
  },
] satisfies Array<{
  firstFormat: Format
  firstVersion: string
  name: string
  secondFormat: Format
  secondVersion: string
}>)(
  'isolates incompatible $name',
  ({ firstFormat, firstVersion, secondFormat, secondVersion }) => {
    const firstFixture = copyRuntime(
      firstFormat,
      'incompatible-first',
      firstVersion,
    )
    const secondFixture = copyRuntime(
      secondFormat,
      'incompatible-second',
      secondVersion,
    )

    runChild(
      `incompatible ${firstFormat}/${secondFormat}`,
      `delete globalThis.__REATOM; ${loadRuntime('first', firstFixture)}; ${loadRuntime('second', secondFixture)}; if (first.VERSION !== ${JSON.stringify(firstVersion)} || second.VERSION !== ${JSON.stringify(secondVersion)}) throw new Error('fixture VERSION was not mutated'); if (first.context === second.context || first.STACK === second.STACK || first.EXTENSIONS === second.EXTENSIONS) throw new Error('incompatible copies share internals'); const firstSlot = first._createGlobal('runtime-isolation.versioned-slot', () => ({ version: first.VERSION })); const secondSlot = second._createGlobal('runtime-isolation.versioned-slot', () => ({ version: second.VERSION })); if (firstSlot === secondSlot || firstSlot.version !== first.VERSION || secondSlot.version !== second.VERSION) throw new Error('incompatible copies share a runtime slot'); ${smokeRuntime('first', 'firstVersionSmoke', 1)}; ${smokeRuntime('second', 'secondVersionSmoke', 2)}`,
    )
  },
  testTimeout,
)
