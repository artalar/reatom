import { JsxNodeBase, ReatomElement } from './types'

// https://github.com/hyoo-ru/mam_mol/blob/master/dom/render/children/children.ts
export function reconcile(
  element: Element,
  nodes: Set<JsxNodeBase>,
  window = globalThis.window,
) {
  let nextNode: Node | null = element.firstChild
  for (let node of nodes) {
    if (node == null || node === false) continue

    if ((node as ReatomElement).element) node = (node as ReatomElement).element
    if (node instanceof window.Node) {
      while (true) {
        if (!nextNode) {
          element.appendChild(node)
          break
        }
        if (nextNode == node) {
          nextNode = nextNode.nextSibling
          break
        } else {
          if (nodes.has(nextNode)) {
            element.insertBefore(node, nextNode)
            break
          } else {
            const nn = nextNode.nextSibling
            element.removeChild(nextNode)
            nextNode = nn
          }
        }
      }
    } else {
      const str = String(node)
      if (nextNode?.nodeName === '#text') {
        if (nextNode.nodeValue !== str) nextNode.nodeValue = str
        nextNode = nextNode.nextSibling
      } else {
        element.insertBefore(window.document.createTextNode(str), nextNode)
      }
    }
  }

  while (nextNode) {
    const currNode = nextNode
    nextNode = currNode.nextSibling
    element.removeChild(currNode)
  }
}
