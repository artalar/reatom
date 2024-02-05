import React from 'react'
import type { GetServerSideProps } from 'next'
import type { AppProps } from 'next/app'
import { connectLogger, Rec } from '@reatom/framework'
import { reatomContext, useCreateCtx } from '@reatom/npm-react'
import { setupUrlAtomSettings } from '@reatom/url'
import { snapshotAtom } from '~/ssrPersist'
import { PersistRecord } from '@reatom/persist'

type Props = {
  snapshot: Rec<PersistRecord>
}

export type AppGetServerSideProps = GetServerSideProps<Props>

export default function App({ Component, pageProps, router }: AppProps<Props>) {
  const ctx = useCreateCtx((ctx) => {
    snapshotAtom(ctx, pageProps.snapshot)
    if (typeof window === 'undefined') {
      const url = new URL(
        router.route,
        //  TODO replace with real origin
        'http://localhost',
      )
      // override default `location` read for SSR
      setupUrlAtomSettings(ctx, () => url)
    } else {
      // turn on logger only for browser
      connectLogger(ctx)
    }
  })

  return (
    <reatomContext.Provider value={ctx}>
      <Component {...pageProps} />
    </reatomContext.Provider>
  )
}
