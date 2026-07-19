import { action, isAbort } from '@reatom/core'

import {
  boundaries,
  type BoundaryHandle,
  jsxBoundary,
} from './global'

export type { BoundaryHandle }
export type JsxErrorPhase = 'children' | 'prop' | 'event' | 'ref' | 'mount'

export interface JsxErrorPayload {
  error: unknown
  phase: JsxErrorPhase
  name: string
  node?: Node
}

/**
 * `a` precedes `b` within the same tree (DOCUMENT_POSITION_FOLLOWING, not
 * DISCONNECTED).
 */
let precedes = (a: Node, b: Node) => {
  let position = a.compareDocumentPosition(b)
  return !(position & 1) && !!(position & 4)
}

/**
 * Find the nearest enclosing ErrorBoundary by the node's current DOM position:
 * the innermost registered boundary whose start..end range contains the node.
 */
export let findBoundary = (node: Node): BoundaryHandle | undefined => {
  let found: BoundaryHandle | undefined
  for (let handle of boundaries) {
    if (
      precedes(handle.start, node) &&
      precedes(node, handle.end) &&
      (!found || precedes(found.start, handle.start))
    ) {
      found = handle
    }
  }
  return found
}

/**
 * Named action for app-level tracking (Sentry via addCallHook / subscribe).
 * Logs to console when {@link DEBUG} is enabled.
 */
export let jsxError = action((payload: JsxErrorPayload): JsxErrorPayload => {
  return payload
}, 'jsx.error')

/**
 * Returns the element marked with `data-reatom-error` (hybrid default path),
 * so the caller can clear the mark via {@link clearJsxError} on the next
 * successful delivery.
 */
export let reportJsxError = (
  error: unknown,
  phase: JsxErrorPhase,
  name: string,
  node?: Node,
): Element | undefined => {
  if (isAbort(error)) return undefined

  jsxError({ error, phase, name, node })

  let boundary = (node && findBoundary(node)) || jsxBoundary.current
  if (boundary) {
    boundary.catch(error)
  } else if (!(error instanceof Promise) && node) {
    let host = node.nodeType === 1 ? (node as Element) : node.parentElement
    host?.setAttribute('data-reatom-error', '')
    return host ?? undefined
  }
  return undefined
}

/** Always returns `undefined` to reset the caller's mark in one assignment. */
export let clearJsxError = (marked?: Element): undefined =>
  void marked?.removeAttribute('data-reatom-error')
