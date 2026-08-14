import type { AtomLike, Frame } from '../core'
import { _read, top } from '../core'

export let _getPrevFrame = (frame = top()): null | Frame => {
  let rec = frame.root.frames.get(frame.atom)

  if (!rec) {
    frame.root.frames.set(
      frame.atom,
      (rec = {
        prev: null,
        next: frame,
      }),
    )
  }

  if (rec.next !== frame) {
    rec.prev = rec.next
    rec.next = frame
  }

  return rec.prev
}

export let _getPrevAtomFrame = (target: AtomLike): null | Frame => {
  let frame = _read(target)
  return frame ? _getPrevFrame(frame) : null
}

export let getPrevState = <T>(target: AtomLike<T>): undefined | T =>
  _getPrevAtomFrame(target)?.state
