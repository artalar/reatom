// root
;<Stack.Provider value={{ startFrom: null, list: [] }}>...</Stack.Provider>

// Container
;({
  constructor() {
    const { stack } = this // from contexts
    if (stack.startFrom === null) stack.startFrom = this.id
  },
  componentDidMount() {
    const { store, stack } = this // from contexts
    if (stack.startFrom === this.id) {
      stack.startFrom = null
      store.subscribe(this.update)

      let cb
      while ((cp = stack.list.pop())) cb()
    } else {
      stack.list.push(() => store.subscribe(this.update))
    }
  },
})
