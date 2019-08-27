import Benchmark from 'benchmark'
import * as RA from './reatom';
import * as RE from './redux'

const results: string[] = []
const suite = new Benchmark.Suite
const times = (len: number, fn: (index: number) => void) => {
  for(var i=0; i<len; i++) fn(i)
}

[10, 100, 1000].forEach(count => {
  ['ALL', 'COMPLETED', 'ACTIVE'].forEach((filter: any) => {
    suite.add(`${count} todos | ${filter} [reatom]`, () => {
      const store = RA.initializeStore();
      store.dispatch(RA.setVisibilityFilter(filter));

      store.subscribe(RA.TodosContent, () => {})

      times(count, i => store.dispatch(RA.addTodo({ id: i, text: `MyTodo ${i}` })))
      times(count, i => store.dispatch(RA.toggleTodo(i)))
    })

    suite.add(`${count} todos | ${filter} [redux]`, () => {
      const store = RE.initializeStore();
      store.dispatch(RE.setVisibilityFilter(filter));

      store.subscribe(() => RE.getVisibleTodos(store.getState(), filter))

      times(count, i => store.dispatch(RE.addTodo({ id: i, text: `MyTodo ${i}` })))
      times(count, i => store.dispatch(RE.toggleTodo(i)))
    })
  })
})

suite.on('cycle', (event: any) => {
  // results.push(String(event.target))
  console.log(String(event.target))
})

// suite.on('complete', function() {
//   console.log(results.join('\n'))
// })

suite.run({ async: true });
