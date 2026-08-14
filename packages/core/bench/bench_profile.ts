/** CPU profile helper: node --cpu-prof --import=tsx bench_profile.ts */
import { atom, computed, notify } from '../src'

const entry = atom(0, 'entry')
const a = computed(() => entry(), 'a')
const b = computed(() => a() + 1, 'b')
const c = computed(() => a() + 1, 'c')
const d = computed(() => b() + c(), 'd')
const e = computed(() => d() + 1, 'e')
const f = computed(() => d() + e(), 'f')
const g = computed(() => d() + e(), 'g')
const h = computed(() => f() + g(), 'h')

let out = 0
h.subscribe((v) => (out = v))

const start = performance.now()
for (let i = 0; i < 300_000; i++) {
  entry.set(i)
  notify()
}
console.log('total ms', (performance.now() - start).toFixed(1), 'out', out)
process.exit(0)
