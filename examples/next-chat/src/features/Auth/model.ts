import { declareAction, declareAtom } from '@reatom/core'

import { fetchAtom } from '~/features/fetch'
import { push } from '~/features/router'

export const onInput = declareAction(
  (name: `name` | `password`, value: string) => ({ payload: { name, value } }),
)

export const onSubmit = declareAction(`auth/onSubmit`)

export const authAtom = declareAtom(
  { name: ``, password: `` },
  ($, state) => {
    const fetch = $(fetchAtom)

    $(
      onInput.handle(
        ({ name, value }) => (state = { ...state, [name]: value }),
      ),
    )

    $(
      onSubmit.handleEffect(async (action, { dispatch }) => {
        const { status } = await fetch(
          `/api/auth?username=${state.name}&password=${state.password}`,
        )

        if (status === 200) dispatch(push(`/chat`))
        else alert(status)
      }),
    )

    return state
  },
  `auth/root`,
)
