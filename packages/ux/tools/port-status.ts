import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(root, '../..')
const ariakitStores = path.join(
  repoRoot,
  'tmp/ariakit/packages/ariakit-components/src',
)
const uxSrc = path.join(root, 'src')

const skipped = new Set(['form', 'menu-bar'])

const featureAlias: Record<string, string> = {
  'composite-overflow': 'composite',
  'menu-bar': 'menubar',
}

function listStoreFeatures(): string[] {
  if (!fs.existsSync(ariakitStores)) {
    console.warn(
      `Ariakit clone missing at ${ariakitStores}. Run:\n` +
        `  git clone https://github.com/ariakit/ariakit.git tmp/ariakit\n` +
        `  (checkout PR 4378 / solid/next for @ariakit/components stores)`,
    )
    return []
  }

  const features: string[] = []
  for (const entry of fs.readdirSync(ariakitStores, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const storeFile = path.join(
      ariakitStores,
      entry.name,
      `${entry.name}-store.ts`,
    )
    const overflowStore = path.join(
      ariakitStores,
      entry.name,
      'composite-overflow-store.ts',
    )
    if (fs.existsSync(storeFile)) features.push(entry.name)
    if (entry.name === 'composite' && fs.existsSync(overflowStore)) {
      features.push('composite-overflow')
    }
    if (entry.name === 'menu') {
      const menuBarStore = path.join(
        ariakitStores,
        entry.name,
        'menu-bar-store.ts',
      )
      if (fs.existsSync(menuBarStore)) features.push('menu-bar')
    }
  }
  return features.sort()
}

function readDeps(feature: string): string[] {
  const dirName = featureAlias[feature] ?? feature
  const fileName =
    feature === 'composite-overflow'
      ? 'composite-overflow-store.ts'
      : feature === 'menu-bar'
        ? 'menu-bar-store.ts'
        : `${feature}-store.ts`
  const file = path.join(ariakitStores, dirName, fileName)
  if (!fs.existsSync(file)) return []
  const source = fs.readFileSync(file, 'utf8')
  const deps = new Set<string>()
  const importRe =
    /from\s+["'](?:\.\.\/)+([a-z0-9-]+)\/[a-z0-9-]+-store(?:\.(?:js|ts))?["']/g
  for (const match of source.matchAll(importRe)) {
    const dep = match[1]
    if (dep && dep !== feature) deps.add(dep)
  }
  return [...deps].sort()
}

function toPascal(feature: string): string {
  return feature
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function portedArtifacts(feature: string): {
  model: boolean
  props: boolean
  unitTest: boolean
  browserTest: boolean
} {
  const dir = path.join(uxSrc, feature)
  const pascal = toPascal(feature)
  return {
    model: fs.existsSync(path.join(dir, `reatom${pascal}.ts`)),
    props: fs.existsSync(path.join(dir, 'props.ts')),
    unitTest: fs.existsSync(path.join(dir, `${feature}.test.ts`)),
    browserTest: fs.existsSync(path.join(dir, `${feature}.test.browser.ts`)),
  }
}

function statusOf(feature: string): 'skipped' | 'ported' | 'partial' | 'todo' {
  if (skipped.has(feature)) return 'skipped'
  const artifacts = portedArtifacts(feature)
  if (artifacts.model && artifacts.unitTest) {
    return artifacts.props ? 'ported' : 'partial'
  }
  if (artifacts.model) return 'partial'
  return 'todo'
}

const features = listStoreFeatures()
const graph = new Map(features.map((feature) => [feature, readDeps(feature)]))

const ported = features.filter((feature) => statusOf(feature) === 'ported')
const partial = features.filter((feature) => statusOf(feature) === 'partial')
const unlocked = features.filter((feature) => {
  if (statusOf(feature) !== 'todo') return false
  const deps = graph.get(feature) ?? []
  return deps.every((dep) => {
    const depStatus = statusOf(dep)
    return depStatus === 'ported' || skipped.has(dep)
  })
})

console.log('# @reatom/ux port status\n')
console.log(`Features scanned: ${features.length}`)
console.log(`Ported: ${ported.length}`)
console.log(`Partial: ${partial.length}`)
console.log(`Unlocked (ready to port): ${unlocked.join(', ') || '(none)'}\n`)

console.log('| Feature | Deps | Status | Model | Props | Unit | Browser |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')
for (const feature of features) {
  const artifacts = portedArtifacts(feature)
  const deps = (graph.get(feature) ?? []).join(', ') || '—'
  const mark = (value: boolean) => (value ? 'yes' : '—')
  console.log(
    `| ${feature} | ${deps} | ${statusOf(feature)} | ${mark(artifacts.model)} | ${mark(artifacts.props)} | ${mark(artifacts.unitTest)} | ${mark(artifacts.browserTest)} |`,
  )
}
