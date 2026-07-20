import { action } from '@reatom/core'

export type JsxErrorPhase = 'children' | 'prop' | 'event' | 'ref' | 'mount'

export interface JsxErrorPayload {
  error: unknown
  phase: JsxErrorPhase
  name: string
  node?: Node
}

/**
 * Named action for app-level tracking (Sentry via addCallHook / subscribe).
 * Logs to console when {@link DEBUG} is enabled.
 */
export let jsxError = action((payload: JsxErrorPayload): JsxErrorPayload => {
  return payload
}, 'jsx.error')
