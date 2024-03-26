import { useAction, useAtom } from '@reatom/npm-react'

import { fetchImages, pageAtom, fetchTimingsAtom } from './model'
import { Lens } from './lens'
import './app.css'

const Paging = () => {
  const [page] = useAtom(pageAtom)
  const prev = useAction((ctx) => pageAtom.prev(ctx))
  const next = useAction((ctx) => pageAtom.next(ctx))

  return (
    <>
      <button onClick={prev}>prev</button>
      <span> page: {page} </span>
      <button onClick={next}>next</button>
    </>
  )
}

export const App = () => {
  const [{ duration }] = useAtom(fetchTimingsAtom)
  const [data] = useAtom(fetchImages.dataAtom)
  const [isLoading] = useAtom((ctx) => {
    console.log(ctx.cause)

    return ctx.spy(fetchImages.pendingAtom) > 0
  })

  return (
    <div>
      <h1>artic.edu</h1>
      <Paging />
      <span>{!!isLoading && ` (Loading)`}</span>
      <p>
        <small>Loaded by {duration}ms</small>
      </p>
      <ul>
        {data.map(({ image_id, title }) => (
          <Lens
            key={image_id}
            src={`https://www.artic.edu/iiif/2/${image_id}/full/843,/0/default.jpg`}
            alt={title}
            width={'20rem'}
            height={'20rem'}
          />
        ))}
      </ul>
    </div>
  )
}
