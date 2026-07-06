import type { AdminFrame } from '../types'

export function isActionFrame(frame: AdminFrame): boolean {
  return frame.params !== undefined
}

export function getFrameExportPayload(
  frame: AdminFrame,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    state: frame.state,
  }

  if (frame.params !== undefined) {
    payload.params = frame.params
  }

  if (frame.payload !== undefined) {
    payload.payload = frame.payload
  }

  if (frame.error !== null) {
    payload.error = frame.error
  }

  return payload
}

export function getFrameInspectorPayload(
  frame: AdminFrame,
): Record<string, unknown> {
  if (isActionFrame(frame)) {
    const payload: Record<string, unknown> = {
      params: frame.params,
    }

    if (frame.payload !== undefined) {
      payload.payload = frame.payload
    }

    return payload
  }

  return {
    state: frame.state,
  }
}
