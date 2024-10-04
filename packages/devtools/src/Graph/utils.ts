import { __root, AtomCache, AtomProto } from '@reatom/framework'

export const getColor = ({ proto }: AtomCache) =>
  proto.isAction
    ? proto.name!.endsWith('.onFulfill')
      ? '#e6ab73'
      : proto.name!.endsWith('.onReject')
      ? '#e67373'
      : '#ffff80'
    : '#151134'

export const getStartCause = (cause: AtomCache): AtomCache =>
  cause.cause?.cause == null ? cause : getStartCause(cause.cause)

const idxMap = new WeakMap<AtomCache, string>()
let idx = 0
export const getId = (node: AtomCache) => {
  let id = idxMap.get(node)
  if (!id) {
    idxMap.set(node, (id = `${node.proto.name}-${++idx}`))
  }
  return id
}

export const followingsMap = new (class extends WeakMap<AtomCache, Array<AtomCache>> {
  add(patch: AtomCache) {
    const startCause = getStartCause(patch)
    if (startCause !== patch) {
      const list = this.get(startCause) ?? []
      list.push(patch)
      this.set(startCause, list)
    }
  }
})()

export const highlighted = new Set<AtomCache>()

export const actionsStates = new WeakMap<AtomCache, Array<any>>()

export const history = new (class extends WeakMap<AtomProto, Array<AtomCache>> {
  add(patch: AtomCache) {
    let list = this.get(patch.proto)
    if (!list) {
      list = []
      this.set(patch.proto, list)
    }
    list.unshift(patch)
  }
})()
