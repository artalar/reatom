import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCtx } from '@reatom/npm-react'
import { updateFromSource, urlAtom } from '@reatom/url'

export const RouterSync = () => {
  const ctx = useCtx()
  const setupRef = React.useRef(false)

  // subscribe to location changes
  useLocation()
  if (ctx.get(urlAtom).href !== location.href && setupRef.current) {
    // do not use `useEffect` to prevent race conditions (`urlAtom` reading during the render)
    updateFromSource(ctx, new URL(location.href))
  }

  const navigate = useNavigate()
  if (!setupRef.current) {
    setupRef.current = true
    urlAtom.settingsAtom(ctx, {
      init: () => new URL(location.href),
      sync: (_ctx, url, replace) =>
        navigate(url.pathname + url.search, { replace }),
    })
    // trigger `onChange` hooks.
    urlAtom(ctx, new URL(location.href))
  }

  return null
}
