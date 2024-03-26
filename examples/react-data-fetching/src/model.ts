import {
  atom,
  onConnect,
  reatomAsync,
  withDataAtom,
  withCache,
  withReducers,
  withAbort,
  withStatusesAtom,
} from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'
import { withSearchParamsPersist } from '@reatom/url'

type ImageData = { image_id: string; title: string }

export const fetchImages = reatomAsync(
  (ctx, page) =>
    fetch(
      `https://api.artic.edu/api/v1/artworks?fields=image_id,title&page=${page}&limit=${10}`,
      ctx.controller,
    ).then<{ data: Array<ImageData> }>((r) => r.json()),
  'fetchImages',
).pipe(
  withAbort({ strategy: 'last-in-win' }),
  withDataAtom([], (ctx, payload) => payload.data.filter((el) => el.image_id)),
  withCache({
    withPersist: withLocalStorage,
    swr: false,
    length: 30,
  }),
  withStatusesAtom(),
)
onConnect(fetchImages.dataAtom, (ctx) => fetchImages(ctx, 1))

export const pageAtom = atom(1, 'pageAtom').pipe(
  withReducers({
    next: (state) => state + 1,
    prev: (state) => Math.max(1, state - 1),
  }),
  withSearchParamsPersist('page', (page) => Number(page || 1)),
)
pageAtom.onChange((ctx, page) => fetchImages(ctx, page))

export const fetchTimingsAtom = atom(
  (ctx, state = { start: 0, duration: 0 }) => {
    ctx.spy(fetchImages, () => {
      state = { start: Date.now(), duration: 0 }
    })
    ctx.spy(fetchImages.onSettle, () => {
      state = { ...state, duration: Date.now() - state.start }
    })
    return state
  },
)
