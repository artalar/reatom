import { atom } from '@reatom/core'
import { ctx } from '@reatom/jsx'

export const cursorX = atom(-1, 'cursorX')
export const cursorY = atom(-1, 'cursorY')

globalThis.addEventListener?.('mousemove', (event) => {
  cursorX(ctx, event.pageX)
  cursorY(ctx, event.pageY)
})
