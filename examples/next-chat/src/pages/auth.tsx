import React from 'react'
import { GetServerSideProps } from 'next'
import { atom } from '@reatom/core'
import { useAtom } from '@reatom/react'

import { Auth } from '~/features/Auth'
import { authAtom } from '~/features/Auth/model'
import { getMessages } from './api/messages'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { session } = context.req?.cookies ?? {}
  // TODO: this logic should be in _model_ layer
  const messages = session && (await getMessages(session))

  return {
    props: {},
    redirect: messages ? { destination: `/chat`, permanent: false } : undefined,
  }
}

function AuthPage() {
  // FIXME: replace by `useInit`
  useAtom(authAtom)

  return <Auth />
}

export default AuthPage
