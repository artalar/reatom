import { computed } from '@reatom/core'

import { ADMIN_FRAME } from '../root'
import type {
  AdminAtom,
  AdminFrame,
  AdminSummary,
  HighlightStyle,
  StateTreeNode,
} from '../types'

export interface AdminViewModelDeps {
  frames: () => AdminFrame[]
  visibleFrames: () => AdminFrame[]
  highlightedFrames: () => Map<number, HighlightStyle>
  atoms: () => Map<string, AdminAtom>
  selectedFrameId: () => number | null
  source: () => 'live' | 'replay'
}

interface StateTreeGroupNode extends StateTreeNode {
  kind: 'group'
  children: Array<StateTreeNode>
}

function isStateTreeGroupNode(node: StateTreeNode): node is StateTreeGroupNode {
  return node.kind === 'group'
}

function splitAtomPath(name: string): Array<string> {
  return name.split(/[.#]/g).filter((part) => part.length > 0)
}

function sortTree(nodes: Array<StateTreeNode>): Array<StateTreeNode> {
  return [...nodes]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'group' ? -1 : 1
      }
      return left.label.localeCompare(right.label)
    })
    .map((node) => ({
      ...node,
      children: sortTree(node.children),
    }))
}

function getOrCreateGroupNode(
  groups: Map<string, StateTreeGroupNode>,
  key: string,
  label: string,
  path: string,
): StateTreeGroupNode {
  const existing = groups.get(key)
  if (existing) return existing

  const created: StateTreeGroupNode = {
    id: `group:${path}`,
    kind: 'group',
    label,
    path,
    children: [],
  }
  groups.set(key, created)
  return created
}

function buildStateTree(
  frames: Array<AdminFrame>,
  atoms: Map<string, AdminAtom>,
): Array<StateTreeNode> {
  const latestStateFrameByAtom = new Map<string, AdminFrame>()
  for (const frame of frames) {
    if (frame.params !== undefined) continue

    const atom = atoms.get(frame.atomId)
    if (!atom?.isReactive) continue

    latestStateFrameByAtom.set(frame.atomId, frame)
  }

  const rootGroups = new Map<string, StateTreeGroupNode>()

  for (const [atomId, frame] of latestStateFrameByAtom) {
    const atom = atoms.get(atomId)
    if (!atom) continue

    const pathParts = splitAtomPath(atom.name)
    if (pathParts.length === 0) continue

    let currentGroups = rootGroups
    let parentNode: StateTreeGroupNode | null = null
    const parentPathParts: Array<string> = []

    for (const segment of pathParts.slice(0, -1)) {
      parentPathParts.push(segment)
      const groupPath = parentPathParts.join('.')
      const groupNode = getOrCreateGroupNode(
        currentGroups,
        groupPath,
        segment,
        groupPath,
      )

      if (
        parentNode &&
        !parentNode.children.some((child) => child.id === groupNode.id)
      ) {
        parentNode.children.push(groupNode)
      }

      parentNode = groupNode

      const childGroups = new Map<string, StateTreeGroupNode>()
      for (const child of groupNode.children) {
        if (isStateTreeGroupNode(child)) {
          childGroups.set(child.path, child)
        }
      }
      currentGroups = childGroups
    }

    const label = pathParts[pathParts.length - 1] ?? atom.name
    const path = pathParts.join('.')
    const leafNode: StateTreeNode = {
      id: `atom:${atomId}`,
      kind: 'atom',
      label,
      path,
      atomId,
      frameId: frame.id,
      value: frame.state,
      children: [],
    }

    if (parentNode) {
      parentNode.children = parentNode.children
        .filter((child) => child.id !== leafNode.id)
        .concat(leafNode)
      continue
    }

    const rootGroup = getOrCreateGroupNode(rootGroups, path, label, path)
    rootGroups.set(path, {
      ...rootGroup,
      kind: 'group',
      label,
      path,
      children: [leafNode],
    })
  }

  const rootNodes = Array.from(rootGroups.values()).map((node) => {
    if (
      node.children.length === 1 &&
      node.children[0]?.kind === 'atom' &&
      node.label === node.children[0].label
    ) {
      return node.children[0]
    }
    return node
  })

  return sortTree(rootNodes)
}

export function createAdminViewModel(deps: AdminViewModelDeps) {
  const summary = computed((): AdminSummary => {
    const totalFrames = deps.frames().length
    const visibleFrames = deps.visibleFrames().length
    const hiddenFrames = Math.max(0, totalFrames - visibleFrames)
    const highlightedFrames = deps.highlightedFrames().size
    const errorFrames = deps
      .frames()
      .reduce((count, frame) => (frame.error !== null ? count + 1 : count), 0)
    const uniqueAtoms = new Set(deps.frames().map((frame) => frame.atomId)).size

    return {
      totalFrames,
      visibleFrames,
      hiddenFrames,
      highlightedFrames,
      errorFrames,
      uniqueAtoms,
      selectedFrameId: deps.selectedFrameId(),
      source: deps.source(),
    }
  }, '_Admin.view.summary')

  const stateTree = computed(() => {
    return buildStateTree(deps.frames(), deps.atoms())
  }, '_Admin.view.stateTree')

  const visibleStateTree = computed(() => {
    return buildStateTree(deps.visibleFrames(), deps.atoms())
  }, '_Admin.view.visibleStateTree')

  return {
    summary,
    stateTree,
    visibleStateTree,
  }
}

export function createAdminViewModelManager(deps: AdminViewModelDeps) {
  return ADMIN_FRAME.run(() => createAdminViewModel(deps))
}
