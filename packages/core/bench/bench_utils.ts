import { readFile, writeFile } from 'fs/promises'
import { cpus } from 'os'
import path from 'path'

type LibName = string
type LibValues = ReturnType<typeof formatLog>
type IterationName = number
type IterationValues = Record<LibName, LibValues>
type BenchResults = Record<IterationName, IterationValues>
type Iterations = Array<IterationName>['length']
type Point = [number, number]
type ChartData = Array<{
  name: string
  version: string
  color: string
  min: Point[]
  med: Point[]
  max: Point[]
  medValue: number
  labelY: number
}>

const DOWNLOAD_LIMIT = 500

const DIR = import.meta.dirname
const CPU = cpus()[0]?.model?.replace(/ /g, '_') ?? 'unknown_cpu'
const POPULAR_CHART_FILE = `popular_chart_${CPU}.svg`
const ALL_CHART_FILE = `all_chart_${CPU}.svg`
const POPULAR_CHART_PATH = path.join(DIR, POPULAR_CHART_FILE)
const ALL_CHART_PATH = path.join(DIR, ALL_CHART_FILE)
const CHART_TEMPLATE = path.join(DIR, 'chart_template.svg')
const README_PATH = path.join(DIR, 'README.md')
const START_MARK = '<!--CONTENT_START-->'
const END_MARK = '<!--CONTENT_END-->'
const REGEX = new RegExp(`${START_MARK}(.*)${END_MARK}`, 'gms')

const X_START = 100
const X_STEP = 230
const Y_START = 20
const Y_RANGE = 500
const LABEL_HEIGHT = 16

const hsl = (i: number, length: number) => {
  const h = Math.round((i * 360) / length) % 360
  return `hsl(${h}, 90%, 45%)`
}

const PACKAGE_NAMES: Rec<string> = {
  'effector.fork': 'effector',
  frpts: '@frp-ts/core',
  mol: 'mol_wire_lib',
  preact: '@preact/signals-core',
  reatom: '@reatom/core',
  solid: 'solid-js',
  v4: 'v4',
}

export async function genChart(allResults: BenchResults) {
  const popularLibs: string[] = []
  for (const libName of Object.keys(Object.values(allResults)[0]!)) {
    const moduleName = PACKAGE_NAMES[libName] ?? libName
    const moduleUrlName = moduleName.replace('/', '%2F')
    const downloadsUrl = `https://api.npmjs.org/versions/${moduleUrlName}/last-week`
    const downloads = await fetch(downloadsUrl)
      .then((r) => r.json())
      .then(({ downloads }: { downloads: Rec<number> }) =>
        Object.values(downloads).reduce((acc, v) => acc + v, 0),
      )
      .catch((error) => {
        console.error(`Failed to fetch downloads for ${name}`)
        console.log(error)
        return 0
      })
    if (downloads > DOWNLOAD_LIMIT) popularLibs.push(libName)
  }
  const popularResults = Object.fromEntries(
    Object.entries(allResults).map(([iteration, iterationValues]) => [
      iteration,
      Object.fromEntries(
        Object.entries(iterationValues).filter(([libName]) =>
          popularLibs.includes(libName),
        ),
      ),
    ]),
  )

  const template = await readFile(CHART_TEMPLATE, 'utf8')
  const allData = await getChartData(allResults)
  const popularData = await getChartData(popularResults)
  const svgAll = allData.map(getLibSVG).join('')
  const svgPopular = popularData.map(getLibSVG).join('')

  await writeFile(
    ALL_CHART_PATH,
    template.replace(REGEX, START_MARK + svgAll + END_MARK),
  )
  await writeFile(
    POPULAR_CHART_PATH,
    template.replace(REGEX, START_MARK + svgPopular + END_MARK),
  )

  let readme = await readFile(README_PATH, 'utf8')
  if (readme.includes(CPU)) {
    readme = readme.replace(
      new RegExp(`### ${CPU}(.|\n)*<!-- ### ${CPU} -->`),
      `### ${CPU}

![](./${POPULAR_CHART_FILE})

<details>
<summary>all results</summary>

![](./${ALL_CHART_FILE})

</details>

<!-- ### ${CPU} -->`,
    )
  } else {
    readme = readme.replace(
      '## Results (`bench_computed`)',
      `## Results (\`bench_computed\`)

### ${CPU}

![](./${POPULAR_CHART_FILE})

<details>
<summary>all results</summary>

![](./${ALL_CHART_FILE})

</details>

<!-- ### ${CPU} -->`,
    )
  }

  await writeFile(README_PATH, readme)
}

async function getChartData(results: BenchResults): Promise<ChartData> {
  const fastest = {
    min: [] as Array<Iterations>,
    med: [] as Array<Iterations>,
    max: [] as Array<Iterations>,
  }
  const libsResults: Rec<typeof fastest> = {}
  const data: ChartData = []

  let i = -1
  for (const [, iterationValues] of Object.entries(results)) {
    i++

    if (!fastest.min[i]) fastest.min[i] = Infinity
    if (!fastest.med[i]) fastest.med[i] = Infinity
    if (!fastest.max[i]) fastest.max[i] = Infinity

    for (const [lib, libValues] of Object.entries(iterationValues)) {
      const group = (libsResults[lib] ??= {
        min: [],
        med: [],
        max: [],
      })

      group.min.push(libValues.min)
      group.med.push(libValues.med)
      group.max.push(libValues.max)

      if (libValues.min < fastest.min[i]!) {
        fastest.min[i] = libValues.min
      }

      if (libValues.med < fastest.med[i]!) {
        fastest.med[i] = libValues.med
      }

      if (libValues.max < fastest.max[i]!) {
        fastest.max[i] = libValues.max
      }
    }
  }

  const libsNames = Object.keys(libsResults).sort()

  const toPoint = (v: number, i: number) => getPoint(v, fastest.med[i]!, i)
  for (const [lib, libResults] of Object.entries(libsResults)) {
    const moduleName = PACKAGE_NAMES[lib] || lib
    const color = hsl(libsNames.indexOf(lib), libsNames.length)
    const min = libResults.min.map(toPoint)
    const med = libResults.med.map(toPoint)
    const max = libResults.max.map(toPoint)
    const medValue = libResults.med[0]!
    const modulePath = path.join(
      __dirname,
      'node_modules',
      moduleName,
      'package.json',
    )
    const file = await readFile(modulePath, 'utf8').catch(
      () => '{"version": "0.0.0"}',
    )
    const version = JSON.parse(file).version

    data.push({
      name: lib,
      version,
      color,
      min,
      med,
      max,
      medValue,
      labelY: 0,
    })
  }

  data.sort((a, b) => a.medValue - b.medValue)

  data.forEach((el, i, arr) => {
    el.labelY = el.med[0]![1]! + 3

    if (i && el.labelY - arr[i - 1]!.labelY < LABEL_HEIGHT) {
      el.labelY = arr[i - 1]!.labelY + LABEL_HEIGHT
    }
  })

  return data
}

function getPoint(value: number, minValue: number, step: number): Point {
  const x = X_START + X_STEP * step
  const y = Y_START + Y_RANGE * (1 - minValue / value)

  return [x, y]
}

function getLibSVG({
  name: lib,
  color,
  med,
  labelY,
  version,
}: ChartData[number]) {
  return `<g>
    <text
      class="lib-label"
      x="95"
      y="${labelY}"
      fill="${color}"
    >${lib} ${version}</text>
    <polyline
      class="line-med"
      fill="none"
      stroke="${color}" 
      points="${med.map((point) => point.join()).join(' ')}"
    ></polyline>
  </g>`
}

export type Rec<T = any> = Record<string, T>

export const POSITION_KEY = 'pos %'

export function printLogs(results: Rec<ReturnType<typeof formatLog>>) {
  const medFastest = Math.min(...Object.values(results).map(({ med }) => med))

  const tabledData = Object.entries(results)
    .sort(([, { med: a }], [, { med: b }]) => a - b)
    .reduce((acc, [name, { min, med, max }]) => {
      acc[name] = {
        [POSITION_KEY]: ((medFastest / med) * 100).toFixed(0),
        'avg ms': med.toFixed(3),
        'min ms': min.toFixed(5),
        'med ms': med.toFixed(5),
        'max ms': max.toFixed(5),
      }
      return acc
    }, {} as Rec<Rec>)

  console.table(tabledData)

  return tabledData
}

export function formatPercent(n = 0) {
  return `${n < 1 ? ` ` : ``}${(n * 100).toFixed(0)}%`
}

export function formatLog(values: Array<number>) {
  return {
    min: min(values),
    med: med(values),
    max: max(values),
  }
}

export function med(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]!

  return (values[half - 1]! + values[half]!) / 2.0
}

export function min(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = Math.floor(values.length / 20)

  return values[limit]!
}

export function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit]!
}

// test
