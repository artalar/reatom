import { atom, createContext } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { init } from '@reatom/utils'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {atomizeResource} from './'

test(`base`, async () => {
  const ctx = createContext()

  type ImageData = { image_id: string; title: string }

  const pageAtom = atom(0).pipe(
    withReducers({
      next: (state) => state + 1,
      prev: (state) => (state = Math.max(1, state - 1)),
    }),
  )

  // @ts-ignore
  const { fetch } = await import(`cross-fetch`)

  let i = 0
  const imagesResource = atomizeResource(
    `images`,
    new Array<ImageData>(),
    async (state, page: void | number = 0) => {
      if (i++ === 0) throw new Error(`just for test`)
      const result = await fetch(
        `https://api.artic.edu/api/v1/artworks?fields=image_id,title&page=${page}&limit=${10}`,
      )
        .then<{ data: Array<ImageData> }>((r) => r.json())
        .then((resp) => resp.data.filter((el) => el.image_id))

      return result
    },
  )

  const startAtom = atom(NaN, `requestTimeStartAtom`)
  const endAtom = atom(NaN, `requestTimeEndAtom`)
  const requestTimeAtom = atom((ctx, state = 0) => {
    ctx.spy(imagesResource.refetch).forEach((refetchData) => {
      startAtom(ctx, Date.now())
    })

    ctx.spy(imagesResource.onDone).forEach((onDoneData) => {
      state = endAtom(ctx, Date.now()) - ctx.get(startAtom)
    })

    return state
  }, `requestTime`)

  const retryAtom = atom((ctx, state = 0) => {
    if (ctx.spy(imagesResource.onError).length && state < 3) {
      ctx.spy(imagesResource.onError) //?
      state++
      imagesResource.retry(ctx)
    }
    if (ctx.spy(imagesResource.onDone).length) {
      state = 0
    }
    return state
  }, `retry`)
  init(ctx, retryAtom)

  ctx.subscribe(requestTimeAtom, (requestTime) => {
    let log = ``,
      { cause } = ctx.read(requestTimeAtom.__reatom)!
    while (cause) {
      log += `${cause.meta.name}`
      cause = cause === cause.cause ? null : cause.cause
      if (cause) log += ` <-- `
    }

    console.log(log)
  })

  await imagesResource.fetch(ctx).catch(() => null)
})

test.run()
