import React from 'react'
import { GetServerSideProps } from 'next'
import fetch, { Response } from 'cross-fetch'
import { createStore, declareAtom } from '@reatom/core'
import { allSettled } from '@reatom/all-settled'
import { useAction, useAtom } from '@reatom/react'

import { fetchAtom } from '~/features/fetch'
import { pushStateAtom, routerAtom } from '~/features/router'
import { initChat, chatAtom, isOnlineAtom } from '~/features/Chat/model'
import { Chat } from '~/features/Chat'
import { getMessages } from './api/messages'

export const getServerSideProps: GetServerSideProps = async (context) => {
  let redirect: string | undefined
  const mock = {
    [routerAtom.id]: `/chat`,
    [fetchAtom.id]: async (...a: any[]) => {
      if (a[0] === `/api/messages`) {
        const { session } = context.req?.cookies ?? {}
        const messages = await getMessages(session)
        return new Response(JSON.stringify(messages), {
          status: messages ? 200 : 403,
        })
      }
      // @ts-expect-error
      return fetch(...a)
    },
    [pushStateAtom.id]: (data: any, title: string, url: string) => {
      redirect = url
    },
    [isOnlineAtom.id]: false,
  }
  const store = createStore()
  store.init(routerAtom, fetchAtom, chatAtom)

  await allSettled(store, initChat)

  const state = store.getState()
  Object.keys(mock).forEach((key) => delete state[key])

  return {
    props: {
      state,
    },
    redirect: redirect && { destination: redirect, permanent: false },
  }
}

function ChatPage() {
  const handleInitChat = useAction(initChat)

  // FIXME: replace by `useInit`
  useAtom(
    React.useMemo(
      () => declareAtom(($) => ($(chatAtom), null), `chat/controller`),
      [],
    ),
  )

  React.useEffect(() => void handleInitChat(), [])

  return <Chat />
}

export default ChatPage
