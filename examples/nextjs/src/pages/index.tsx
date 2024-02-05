import Head from 'next/head'
import { createCtx, jsonClone, takeNested } from '@reatom/framework'
import { setupUrlAtomSettings } from '@reatom/url'
import { Search, fetchIssues } from '~/features/Search'
import { snapshotAtom } from '~/ssrPersist'
import styles from './styles.module.css'
import { AppGetServerSideProps } from './_app'

export const getServerSideProps = (async ({ req }) => {
  const ctx = createCtx()

  const url = new URL(req.url!, `http://${req.headers.host}`)
  setupUrlAtomSettings(ctx, () => url)

  await takeNested(ctx, fetchIssues)

  // `jsonClone` needs to be used to force the removal of `undefined`, which Next.js fails to do.
  const snapshot = jsonClone(ctx.get(snapshotAtom))

  return {
    props: { snapshot },
  }
}) satisfies AppGetServerSideProps

export default function Home() {
  return (
    <>
      <Head>
        <title>Reatom 🖤 Next.js</title>
        <meta name="description" content="Next.js + Reatom example app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <Search />
      </main>
    </>
  )
}
