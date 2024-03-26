import { Ctx, Unsubscribe, atom } from '@reatom/core'
import { onConnect, onDisconnect } from '@reatom/hooks'
import { unwrap } from '.'
import { JsxNode } from './types'

export interface LifecycleProps {
  children: JsxNode
  onConnect?: (ctx: Ctx) => Unsubscribe | undefined
  onDisconnect?: (ctx: Ctx) => void
}

export function Lifecycle(props: LifecycleProps) {
  const lifecycle = atom((ctx) => unwrap(ctx, props.children))
  if (props.onConnect) onConnect(lifecycle, props.onConnect)
  if (props.onDisconnect) onDisconnect(lifecycle, props.onDisconnect)
  return lifecycle
}
