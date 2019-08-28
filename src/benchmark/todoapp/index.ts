import Benchmark from 'benchmark'
import * as RA from './reatom';
import * as RE from './redux'

let reatomStore = RA.initializeStore();
let reduxStore = RE.initializeStore();
const results: string[] = []

const suite = new Benchmark.Suite('Todo', {
  onCycle: function() {
    reatomStore = RA.initializeStore();
    reduxStore = RE.initializeStore();
  }
})

const times = (len: number, fn: (index: number) => void) => {
  for(var i=0; i<len; i++) fn(i)
}

[10, 100].forEach(count => [1, 10, 50].forEach(subscribersCount => {
  ['ALL', 'COMPLETED', 'ACTIVE'].forEach((filter: any) => {
    suite.add(`(${subscribersCount}) ${count} todos | ${filter} [reatom]`, () => {
      const store = reatomStore;

      store.dispatch(RA.setVisibilityFilter(filter));

      times(subscribersCount, () => store.subscribe(RA.TodosContent, () => {}))

      times(count, i => store.dispatch(RA.addTodo({ id: i, text: `MyTodo ${i}` })))
      times(count, i => store.dispatch(RA.toggleTodo(i)))
    })

    suite.add(`(${subscribersCount}) ${count} todos | ${filter} [redux]`, () => {
      const store = reduxStore;

      store.dispatch(RE.setVisibilityFilter(filter));

      times(subscribersCount, () => store.subscribe(() => RE.getVisibleTodos(store.getState(), filter)))

      times(count, i => store.dispatch(RE.addTodo({ id: i, text: `MyTodo ${i}` })))
      times(count, i => store.dispatch(RE.toggleTodo(i)))
    })
  })
}))


suite.on('cycle', (event: any) => {
  // results.push(String(event.target))
  console.log(String(event.target))
})

// suite.on('complete', function() {
//   console.log(results.join('\n'))
// })

suite.run({ async: true });
