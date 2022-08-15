import { declareAction, declareAtom } from '@reatom/core'

import { fetchAtom } from '~/features/fetch'
import { push } from '~/features/router'
import type { Message } from '~/features/types'

export const initChat = declareAction(`chat/initChat`)
export const getMessages = declareAction(`chat/getMessages`)
export const receiveMessages = declareAction<Array<Message>>(
  `chat/receiveMessages`,
)
export const sendMessage = declareAction<string>(`chat/sendMessage`)

export const isOnlineAtom = declareAtom(true, `chat/isOnline`)

export const messagesAtom = declareAtom(
  new Array<Message>(),
  ($, state) => {
    const fetch = $(fetchAtom)

    $(
      initChat.handleEffect(async (action, store) => {
        do {
          store.dispatch(getMessages())
          await sleep(1000)
        } while (store.getState(isOnlineAtom))
      }),
    )

    $(
      getMessages.handleEffect(async (action, { dispatch }) => {
        try {
          let path = `/api/messages`
          if (state.length > 0) {
            path += `?from=${state[state.length - 1].id}`
          }
          const messages = await fetch(path).then<Array<Message>>(
            (response) => {
              if (response.status === 200) return response.json()
              throw new Error(response.status.toString())
            },
          )
          dispatch(receiveMessages(messages))
        } catch (error) {
          dispatch(push(`/auth`))
        }
      }),
    )

    $(receiveMessages.handle((messages) => (state = [...state, ...messages])))

    $(
      sendMessage.handleEffect(({ payload: text }) => {
        fetch(`/api/messages`, {
          method: `post`,
          body: JSON.stringify({ text }),
        })
      }),
    )

    return state
  },
  `chat/messages`,
)

// export atom with domain name
// thats combine all dependent atoms and handle all needed logic.
// It may be called as "domain" or domain "root" atom.
export const chatAtom = declareAtom(($) => {
  $(isOnlineAtom)
  $(messagesAtom)
  return null
}, `chat/root`)
