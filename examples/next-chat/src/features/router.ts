import { declareAction, declareAtom } from '@reatom/core'

export const push = declareAction(
  (path: string, title?: string) => ({
    payload: { path, title },
  }),
  `router/push`,
)

export const pushStateAtom = declareAtom(
  ($, state = history.pushState.bind(history)) => state,
  `router/pushState`,
)

export const routerAtom = declareAtom(($, state = window.location.pathname) => {
  const pushState = $(pushStateAtom)

  $(push.handle(({ path }) => (state = path)))
  $(
    push.handleEffect(({ payload }) =>
      pushState({}, payload.title ?? ``, state),
    ),
  )

  return state
}, `router/root`)
