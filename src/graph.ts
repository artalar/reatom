export type Ctx = {
  flat: { [key in string]: any }
  flatNew: { [key in string]: any }
  visited: { [key in string]: any }
  type: string
  payload: any
}

let nodeCount = 0
function normalizeId(id: string) {
  return id[0] === '@' ? id : `${id} [${++nodeCount}]`
}

// type Leaf = Node
export class Node {
  id: string
  complete: (ctx: Ctx) => any
  match: (ctx: Ctx) => any
  deps: { [id: string]: 0 }
  edges: Node[]
  initialState: undefined
  constructor(id = 'node', complete: (ctx: Ctx) => any, match: (ctx: Ctx) => any) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Invalid id')
    }
    if (typeof complete !== 'function') {
      throw new TypeError('Invalid complete')
    }

    this.id = id = normalizeId(id)
    this.complete = complete
    this.match = match
    this.deps = { [id]: 0 }
    this.edges = []
    this.initialState = undefined
  }
}

export type Edge<T> = Node & { initialState: T }

export function traverse(node: Node, ctx: Ctx) {
  if (node.match(ctx)) {
    // // 'cyclic' | 'visited'
    // if (ctx.line[node.id] !== undefined) {
    //   ctx.line[node.id] = 'cyclic'
    //   return
    // }

    // ctx.line[node.id] = 'visited'

    node.edges.forEach(childNode => {
      traverse(childNode, ctx)
    })

    node.complete(ctx)

    // // 'cyclic' | 'visited'
    // if (ctx.line[node.id] === 'cyclic') {
    //   travers(node, ctx)
    // }
    // ctx.line[node.id] = undefined
  }
}
