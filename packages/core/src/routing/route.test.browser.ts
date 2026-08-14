import { beforeEach, expect, expectTypeOf, test, vi } from 'test'
import { z } from 'zod'

import { computed } from '../core'
import { withChangeHook } from '../extensions'
import { effect, wrap } from '../methods'
import { sleep } from '../utils'
import { urlAtom } from '../web/url'
import { reatomRoute } from './route'

beforeEach(() => {
  urlAtom.routes = {}
  if (window.location.pathname !== '/') {
    window.history.replaceState({}, '', '/')
  }
})

test('route basic functionality', async () => {
  const rootRoute = reatomRoute('')
  const profilesRoute = reatomRoute('profiles')
  const profileRoute = reatomRoute('profiles/:profileId')
  const postRoute = reatomRoute('posts/:postId?')
  const postCommentsRoute = postRoute.reatomRoute({
    path: 'comments/:commentId',
    search: z.object({ sort: z.string().optional() }),
  })

  rootRoute.go()
  await wrap(sleep())

  expect(urlAtom().pathname).toBe('/')
  expect(rootRoute()).toEqual({})
  expect(rootRoute.exact()).toBe(true)
  expect(profilesRoute()).toBe(null)
  expect(profilesRoute.exact()).toBe(false)
  expect(profileRoute()).toBe(null)
  expect(profileRoute.exact()).toBe(false)
  expect(postRoute()).toBe(null)
  expect(postRoute.exact()).toBe(false)
  expect(postCommentsRoute()).toBe(null)
  expect(postCommentsRoute.exact()).toBe(false)

  urlAtom.go('/profiles')
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/profiles')
  expect(rootRoute()).toEqual({})
  expect(rootRoute.exact()).toBe(false)
  expect(profilesRoute()).toEqual({})
  expect(profilesRoute.exact()).toBe(true)
  expect(profileRoute()).toBe(null)
  expect(profileRoute.exact()).toBe(false)
  expect(postRoute()).toBe(null)
  expect(postRoute.exact()).toBe(false)

  profileRoute.go({ profileId: '123' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/profiles/123')
  expect(rootRoute()).toEqual({})
  expect(profilesRoute()).toEqual({})
  expect(profilesRoute.exact()).toBe(false)
  expect(profileRoute()).toEqual({ profileId: '123' })
  expect(profileRoute.exact()).toBe(true)
  expect(postRoute()).toBe(null)
  expect(postRoute.exact()).toBe(false)

  postRoute.go()
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/posts')
  expect(rootRoute()).toEqual({})
  expect(profilesRoute()).toBe(null)
  expect(profileRoute()).toBe(null)
  expect(postRoute()).toEqual({})
  expect(postRoute.exact()).toBe(true)

  postRoute.go({ postId: 'abc' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/posts/abc')
  expect(postRoute()).toEqual({ postId: 'abc' })
  expect(postRoute.exact()).toBe(true)
  expect(postCommentsRoute()).toBe(null)

  postCommentsRoute.go(
    {
      postId: 'abc',
      commentId: '456',
      sort: 'new',
    },
    true,
  )
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/posts/abc/comments/456')
  expect(urlAtom().search).toBe('?sort=new')
  expect(postRoute()).toEqual({ postId: 'abc' })
  expect(postRoute.exact()).toBe(false)
  expect(postCommentsRoute()).toEqual({
    postId: 'abc',
    commentId: '456',
    sort: 'new',
  })
  expect(postCommentsRoute.exact()).toBe(true)

  expect(rootRoute.path()).toBe('/')
  expect(profilesRoute.path()).toBe('/profiles')
  expect(profileRoute.path({ profileId: 'xyz' })).toBe('/profiles/xyz')
  expect(postRoute.path()).toBe('/posts')
  expect(postRoute.path({ postId: 'def' })).toBe('/posts/def')
  expect(
    postCommentsRoute.path({ postId: '111', commentId: '222', sort: 'new' }),
  ).toBe('/posts/111/comments/222?sort=new')

  rootRoute.go()
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/')
  expect(rootRoute()).toEqual({})
  expect(rootRoute.exact()).toBe(true)
  expect(profileRoute()).toBe(null)
  expect(postCommentsRoute()).toBe(null)
})

test('route chainable functionality', async () => {
  const apiRoute = reatomRoute('api')
  const productsRoute = apiRoute.reatomRoute('products')
  const productDetailsRoute = productsRoute.reatomRoute(':productId')
  const productSettingsRoute = productDetailsRoute.reatomRoute('settings')
  const productItemsRoute = productDetailsRoute.reatomRoute('items/:itemId?')

  urlAtom.go('/')
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/')
  expect(apiRoute()).toBe(null)
  expect(productsRoute()).toBe(null)
  expect(productDetailsRoute()).toBe(null)
  expect(productSettingsRoute()).toBe(null)
  expect(productItemsRoute()).toBe(null)

  productDetailsRoute.go({ productId: 'abc' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/api/products/abc')
  expect(apiRoute()).toEqual({})
  expect(apiRoute.exact()).toBe(false)
  expect(productsRoute()).toEqual({})
  expect(productsRoute.exact()).toBe(false)
  expect(productDetailsRoute()).toEqual({ productId: 'abc' })
  expect(productDetailsRoute.exact()).toBe(true)
  expect(productSettingsRoute()).toBe(null)
  expect(productItemsRoute()).toEqual(null)

  productSettingsRoute.go({ productId: 'abc' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/api/products/abc/settings')
  expect(apiRoute()).toEqual({})
  expect(productsRoute()).toEqual({})
  expect(productDetailsRoute()).toEqual({ productId: 'abc' })
  expect(productDetailsRoute.exact()).toBe(false)
  expect(productSettingsRoute()).toEqual({ productId: 'abc' })
  expect(productSettingsRoute.exact()).toBe(true)
  expect(productItemsRoute()).toBe(null)

  productItemsRoute.go({ productId: 'abc' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/api/products/abc/items')
  expect(productDetailsRoute()).toEqual({ productId: 'abc' })
  expect(productDetailsRoute.exact()).toBe(false)
  expect(productSettingsRoute()).toBe(null)
  expect(productItemsRoute()).toEqual({ productId: 'abc' })
  expect(productItemsRoute.exact()).toBe(true)

  productItemsRoute.go({ productId: 'abc', itemId: 'p123' })
  await wrap(sleep())
  expect(urlAtom().pathname).toBe('/api/products/abc/items/p123')
  expect(productItemsRoute()).toEqual({ productId: 'abc', itemId: 'p123' })
  expect(productItemsRoute.exact()).toBe(true)

  expect(apiRoute.path()).toBe('/api')
  expect(productsRoute.path()).toBe('/api/products')
  expect(productDetailsRoute.path({ productId: 'xyz' })).toBe(
    '/api/products/xyz',
  )
  expect(productSettingsRoute.path({ productId: 'xyz' })).toBe(
    '/api/products/xyz/settings',
  )
  expect(productItemsRoute.path({ productId: 'xyz' })).toBe(
    '/api/products/xyz/items',
  )
  expect(productItemsRoute.path({ productId: 'xyz', itemId: 'p456' })).toBe(
    '/api/products/xyz/items/p456',
  )
})

test('route typed params', () => {
  {
    reatomRoute({
      path: 'catalog/:id',
      // @ts-expect-error - test
      params: z.object({ /* mistake -> */ ib: z.number() }),
    })
  }

  const catalogRoute = reatomRoute({
    path: 'catalog/:id',
    params: z.object({ id: z.number() }),
  })

  // @ts-expect-error - test
  expect(() => catalogRoute.go({ id: '42' })).toThrow()

  expect(catalogRoute.go({ id: 42 }).pathname).toBe('/catalog/42')
})

test('route default loader', async () => {
  const goodsRoute = reatomRoute({
    path: 'goods/:category',
    params: z.object({ category: z.string() }),
    search: z.object({
      sort: z.enum(['asc', 'desc']).optional(),
    }),
  })

  const goods = computed(async () => {
    const params = await wrap(goodsRoute.loader())

    const url = `/api/goods/${params.category}?sort=${params.sort}`
    const resp = await wrap(Promise.resolve({ json: () => [{ id: url }] }))
    return resp.json()
  })

  const track = vi.fn()

  effect(async () => {
    const data = await wrap(goods().catch(() => null))
    if (data) track(data)
  })

  await wrap(sleep())
  expect(track).toBeCalledTimes(0)

  goodsRoute.go({ category: 'tech' })
  await wrap(sleep())
  expect(track).toBeCalledTimes(1)
  expect(track).toBeCalledWith([{ id: `/api/goods/tech?sort=undefined` }])
})

test('route loader', async () => {
  const goodsRoute = reatomRoute('goods/:category')
  const goodsBrandRoute = goodsRoute.reatomRoute({
    path: ':brand',
    search: z.object({
      sort: z.enum(['asc', 'desc']).optional(),
    }),
    async loader(params) {
      expectTypeOf(params).toEqualTypeOf<{
        category: string
        brand: string
        sort?: 'asc' | 'desc' | undefined
      }>()

      expect(params).toEqual({
        category: 'tech',
        brand: 'apple',
        sort: 'asc',
      })

      const url = `/api/goods/${params.category}/${params.brand}?sort=${params.sort}`
      const resp = await wrap(Promise.resolve({ json: () => [{ id: url }] }))
      return resp.json()
    },
  })

  const track = vi.fn()

  effect(async () => {
    const data = await wrap(goodsBrandRoute.loader().catch(() => null))
    if (data) track(data)
  })

  await wrap(sleep())
  expect(track).toBeCalledTimes(0)

  goodsBrandRoute.go({ category: 'tech', brand: 'apple', sort: 'asc' })
  await wrap(sleep())
  expect(track).toBeCalledTimes(1)
  expect(track).toBeCalledWith([{ id: `/api/goods/tech/apple?sort=asc` }])

  expect(() =>
    // @ts-expect-error - test
    goodsBrandRoute.go({ category: 'tech', brand: 'apple', sort: 'asd' }),
  ).toThrow()
})

test('route loader data reset on unmatch with extension', async () => {
  const goodsRoute = reatomRoute({
    path: 'goods/:category',
    async loader({ category }) {
      return [{ id: category }]
    },
  })

  goodsRoute.extend(
    withChangeHook((match) => {
      if (match === null) goodsRoute.loader.data.reset()
    }),
  )

  goodsRoute.go({ category: 'tech' })
  expect(await wrap(goodsRoute.loader())).toEqual([{ id: 'tech' }])
  expect(goodsRoute.loader.data()).toEqual([{ id: 'tech' }])

  urlAtom.go('/')
  await wrap(sleep())

  expect(goodsRoute()).toBe(null)
  expect(goodsRoute.loader.data()).toBe(undefined)
})

test('route loader lazyness (abortable)', async () => {
  let runs = 0
  let ticks = 0
  let changes = 0

  const lazyRoute = reatomRoute({
    path: 'lazy',
    async loader() {
      runs++
      effect(async () => {
        try {
          while (true) {
            ticks++
            await wrap(sleep())
          }
        } catch {
          // aborted
        }
      })
    },
  })

  lazyRoute.loader.extend(
    withChangeHook((state) => {
      console.log(state)
      changes++
    }),
  )

  lazyRoute.go()

  await wrap(Promise.resolve())

  expect(changes).toBe(1)
  expect(runs).toBe(1)
  expect(ticks).toBe(1)

  await wrap(sleep())
  expect(changes).toBe(1)
  expect(runs).toBe(1)
  expect(ticks).toBe(2)

  await wrap(sleep())
  expect(changes).toBe(1)
  expect(runs).toBe(1)
  expect(ticks).toBe(3)

  urlAtom.go('/lazy/123')
  await wrap(sleep())
  expect(changes).toBe(1)
  expect(runs).toBe(1)
  expect(ticks).toBe(4)

  expect(lazyRoute()).toEqual({})
  urlAtom.go('/')
  await wrap(sleep())
  await wrap(sleep())
  await wrap(sleep())
  expect(changes).toBe(2)
  expect(runs).toBe(1)
  expect(ticks).toBe(4)
  expect(lazyRoute()).toBe(null)
})

test('params types transform', async () => {
  const issueRoute = reatomRoute({
    path: 'issue/:issueId',
    params: z.object({
      issueId: z.coerce.number(),
    }),
    async loader(params) {
      return {
        issueId: params.issueId,
      }
    },
  })

  issueRoute.go({ issueId: 123 })

  expect(await wrap(issueRoute.loader())).toEqual({ issueId: 123 })
})

test('search params memo', async () => {
  let route1Track = vi.fn()
  const route1 = reatomRoute('test').extend(withChangeHook(route1Track))
  const route2 = reatomRoute({
    path: 'test',
    search: z.object({
      q: z.string().optional(),
    }),
  })

  route1.go()

  expect(route1()).toEqual({})
  await wrap(sleep()) // wait the hook
  expect(route1Track).toBeCalledTimes(1)
  expect(route2()).toEqual({})

  route2.go({ q: '123' })
  expect(route1()).toEqual({})
  await wrap(sleep()) // wait the hook
  expect(route1Track).toBeCalledTimes(1)
  expect(route2()).toEqual({ q: '123' })
})

test('search-only route should preserve pathname', async () => {
  const dialogRoute = reatomRoute({
    search: z.object({
      dialog: z.enum(['login', 'signup']).optional(),
    }),
  })

  urlAtom.go('/profile/123')
  expect(urlAtom().pathname).toBe('/profile/123')
  expect(urlAtom().search).toBe('')

  dialogRoute.go({ dialog: 'login' })
  expect(urlAtom().pathname).toBe('/profile/123')
  expect(urlAtom().search).toBe('?dialog=login')
  expect(dialogRoute()).toEqual({ dialog: 'login' })

  urlAtom.go('/another/page?dialog=signup')
  expect(urlAtom().pathname).toBe('/another/page')
  expect(dialogRoute()).toEqual({ dialog: 'signup' })

  dialogRoute.go({})
  expect(urlAtom().pathname).toBe('/another/page')
  expect(urlAtom().search).toBe('')
  expect(dialogRoute()).toEqual({})
})

test('search-only route should preserve sub pathname', async () => {
  const authRoute = reatomRoute('auth')
  const dialogRoute = authRoute.reatomRoute({
    search: z.object({
      dialog: z.enum(['login', 'signup']).optional(),
    }),
  })

  urlAtom.go('/some')
  expect(urlAtom().pathname).toBe('/some')

  dialogRoute.go({ dialog: 'login' })
  expect(urlAtom().pathname).toBe('/auth')
  expect(urlAtom().search).toBe('?dialog=login')
  expect(dialogRoute()).toEqual({ dialog: 'login' })

  urlAtom.go('/auth/email')
  expect(urlAtom().pathname).toBe('/auth/email')
  dialogRoute.go({ dialog: 'signup' })
  expect(urlAtom().pathname).toBe('/auth/email')
  expect(urlAtom().search).toBe('?dialog=signup')
})

test('exact for different types of routes', async () => {
  const emptyPathRoute = reatomRoute('')
  const nullPathRoute = reatomRoute({})
  const searchOnlyRoute = reatomRoute({
    search: z.object({ q: z.string().optional() }),
  })
  const someRoute = reatomRoute({ path: 'some' })

  urlAtom.go('/')
  await wrap(sleep())

  expect(emptyPathRoute.exact()).toEqual(true)
  expect(nullPathRoute.exact()).toEqual(true)
  expect(searchOnlyRoute.exact()).toEqual(true)
  expect(someRoute.exact()).toEqual(false)

  for (const go of [
    () => someRoute.go(),
    () => searchOnlyRoute.go({ q: '123' }),
    () => nullPathRoute.go(),
  ]) {
    go()
    expect(emptyPathRoute.exact()).toEqual(false)
    expect(nullPathRoute.exact()).toEqual(true)
    expect(searchOnlyRoute.exact()).toEqual(true)
    expect(someRoute.exact()).toEqual(true)
  }

  emptyPathRoute.go()
  expect(emptyPathRoute.exact()).toEqual(true)
  expect(nullPathRoute.exact()).toEqual(true)
  expect(searchOnlyRoute.exact()).toEqual(true)
  expect(someRoute.exact()).toEqual(false)
})

test('loader data types', async () => {
  const route = reatomRoute({
    async loader() {
      return 42
    },
  })

  const status = route.loader.status()
  expectTypeOf(status.data).toExtend<number | undefined>()

  if (!status.isFulfilled) {
    /* return */
  } else {
    expectTypeOf(status.data).toExtend<number>()
  }
})

test('non-layout route should not render on children match', async () => {
  const parentRoute = reatomRoute({
    path: 'project',
    render() {
      return true
    },
  })

  urlAtom.go('/project/child')
  await wrap(sleep())
  expect(parentRoute.render()).toBeFalsy()
})

test('non-layout route should not affect children', async () => {
  const rootRoute = reatomRoute({
    path: 'root',
    layout: true,
    render(self) {
      return self.outlet().join('')
    },
  })

  const parentRoute = rootRoute.reatomRoute(
    {
      path: 'parent',
      render() {
        return 'parent'
      },
    },
    'parentRoute',
  )
  const childRoute = parentRoute.reatomRoute({
    path: 'child',

    render() {
      return 'child'
    },
  })

  parentRoute.go()
  expect(parentRoute.render()).toBe('parent')
  expect(childRoute.render()).toBeFalsy()

  childRoute.go()
  expect(parentRoute.match()).toBeTruthy()
  expect(parentRoute.render()).toBeFalsy()
  expect(parentRoute.outlet()).toEqual(['child'])
  expect(childRoute.render()).toBe('child')
  expect(rootRoute.outlet()).toEqual(['child'])
  expect(rootRoute.render()).toBe('child')
})

test('layout route without render should block children rendering', async () => {
  const rootRoute = reatomRoute({
    path: 'root',
    layout: true,
    render: (self) => self.outlet(),
  })
  const parentRoute = rootRoute.reatomRoute({
    path: 'parent',
    layout: true,
  })
  const childRoute = parentRoute.reatomRoute({
    path: 'child',
    render: () => 'child',
  })

  childRoute.go()
  expect(parentRoute.match()).toBe(true)
  expect(rootRoute.render()).toEqual([])
})

test('layout route with null render should block children rendering', async () => {
  const rootRoute = reatomRoute({
    path: 'root',
    layout: true,
    render: (self) => self.outlet(),
  })
  const parentRoute = rootRoute.reatomRoute({
    path: 'parent',
    layout: true,
    render: () => null as never,
  })
  const childRoute = parentRoute.reatomRoute({
    path: 'child',
    render: () => 'child',
  })

  childRoute.go()
  expect(parentRoute.match()).toBe(true)
  expect(rootRoute.render()).toEqual([])
})

test('grandchild should render through outlet chain', async () => {
  const layoutRoute = reatomRoute(
    {
      layout: true,
      render(self) {
        return self.outlet().join('') || 'not found'
      },
    },
    'layoutRoute',
  )

  const protectedRoute = layoutRoute.reatomRoute(
    {
      layout: true,
      params: () => ({}),
      render(self) {
        return self.outlet()
      },
    },
    'protectedRoute',
  )

  const projectOverviewRoute = protectedRoute.reatomRoute(
    {
      path: 'projects/:projectId',
      render(self) {
        return `This project #${self().projectId}`
      },
    },
    'projectOverviewRoute',
  )

  const projectReviewRouteCorrect = projectOverviewRoute.reatomRoute(
    {
      path: 'review',
      params: (params) => params,
      render(self) {
        return `This review for project #${self().projectId}`
      },
    },
    'projectReviewRouteCorrect',
  )

  const projectReviewRouteWrong = projectOverviewRoute.reatomRoute(
    {
      path: 'projects/:projectId/review',
      render() {
        return 'reviewWrong'
      },
    },
    'projectReviewRouteCorrect',
  )

  urlAtom.go('/projects/123/review')
  await wrap(sleep())

  expect(projectReviewRouteCorrect.render()).toEqual(
    'This review for project #123',
  )
  expect(projectReviewRouteWrong.render()).toEqual(null)
  expect(layoutRoute.render()).toEqual('This review for project #123')
})

test('inherence of callback params', async () => {
  const dialogRoute = reatomRoute({
    params: ({ open }: { open: boolean }) => ({ open }),
  })

  const profileRoute = dialogRoute.reatomRoute({
    params: ({ profileOf }: { profileOf: string }) =>
      profileOf ? { profileOf } : null,
  })

  const anotherRoute = dialogRoute.reatomRoute({
    params: ({ accountId }: { accountId: string }) =>
      accountId ? { accountId } : null,
  })

  const searchParamsRoute = dialogRoute.reatomRoute({
    search: z.object({ profileId: z.string() }),
  })

  expectTypeOf(profileRoute()).toExtend<{ profileOf: string } | null>()
  expectTypeOf(profileRoute()).not.toExtend<{ open: boolean } | null>()

  profileRoute.go({ open: true, profileOf: 'co_aij21312nm' })
  await wrap(sleep())

  expect(dialogRoute()).toMatchObject({ open: true })
  expect(profileRoute()).toMatchObject({
    profileOf: 'co_aij21312nm',
  })
  expect(anotherRoute()).toBe(null)
  expect(searchParamsRoute()).toBe(null)

  profileRoute.go({ open: false, profileOf: 'co_aij21312nm' })
  await wrap(sleep())

  expect(dialogRoute()).toMatchObject({ open: false })
  expect(profileRoute()).toMatchObject({
    profileOf: 'co_aij21312nm',
  })

  anotherRoute.go({ open: true, accountId: 'accountId' })
  expect(dialogRoute()).toMatchObject({ open: true })
  expect(profileRoute()).toMatchObject({
    profileOf: 'co_aij21312nm',
  })
  expect(anotherRoute()).toMatchObject({
    accountId: 'accountId',
  })

  searchParamsRoute.go({ open: true, profileId: 'profileId' })
  expect(dialogRoute()).toMatchObject({ open: true })
  expect(profileRoute()).toMatchObject({
    profileOf: 'co_aij21312nm',
  })
  expect(anotherRoute()).toMatchObject({
    accountId: 'accountId',
  })
  expect(searchParamsRoute()).toMatchObject({
    profileId: 'profileId',
  })
})

test('inherence of callback params (deep)', async () => {
  const modalRoute = reatomRoute({
    params: ({ visible }: { visible: boolean }) => ({ visible }),
  })

  const settingsRoute = modalRoute.reatomRoute({
    path: 'settings',
  })

  const themeRoute = settingsRoute.reatomRoute({
    params: ({ theme }: { theme: string }) => (theme ? { theme } : null),
  })

  themeRoute.go({ visible: true, theme: 'dark' })
  await wrap(sleep())

  expect(modalRoute()).toMatchObject({ visible: true })
  expect(settingsRoute()).toMatchObject({})
  expect(themeRoute()).toMatchObject({ theme: 'dark' })

  themeRoute.go({ visible: false, theme: 'light' })
  await wrap(sleep())

  expect(modalRoute()).toMatchObject({ visible: false })
  expect(settingsRoute()).toMatchObject({})
  expect(themeRoute()).toMatchObject({ theme: 'light' })
})

test('inherence of callback params from search-only route', async () => {
  const dialogRoute = reatomRoute({
    params: ({ open }: { open: boolean }) => ({ open }),
  })

  const profileRoute = dialogRoute.reatomRoute({
    search: z.object({
      profileOf: z.string().optional(),
    }),
  })

  profileRoute.go({ open: true, profileOf: 'co_aij21312nm' })

  expect(dialogRoute()).toMatchObject({ open: true })
  expect(profileRoute()).toMatchObject({
    profileOf: 'co_aij21312nm',
  })

  profileRoute.go({ open: false, profileOf: 'co_aij21312nm' })

  expect(dialogRoute()).toMatchObject({ open: false })
  expect(profileRoute()).toMatchObject({ profileOf: 'co_aij21312nm' })
})

test('route pattern collision - routes with same pattern but different names', async () => {
  const parentRoute = reatomRoute('parent')

  const route1 = parentRoute.reatomRoute({
    path: 'child',
    async loader() {
      return {}
    },
  })

  const route2 = parentRoute.reatomRoute({
    path: 'child',
    async loader() {
      return {}
    },
  })

  console.log(parentRoute.routes)

  expect(route1.pattern).toBe('/parent/child')
  expect(route2.pattern).toBe('/parent/child')
  expect(route1.pattern).toBe(route2.pattern)

  expect(route1.loader.data()).toBeFalsy()
  expect(route2.loader.data()).toBeFalsy()

  route1.go()
  await wrap(sleep())
  expect(route1.loader.data()).toBeTruthy()
  expect(route2.loader.data()).toBeTruthy()
})

test('params callback with correct search params inherence', () => {
  const userRoute = reatomRoute({
    path: 'user',
    search: z.object({ userId: z.string().optional() }),
  })

  const screenRoute = userRoute.reatomRoute({
    params: (params: { screen: 'main' | 'success' }) => params,
  })

  userRoute.go({ userId: '123' })
  expect(userRoute()).toMatchObject({ userId: '123' })

  screenRoute.go({ screen: 'main' })
  expect(screenRoute()).toMatchObject({ screen: 'main' })
  expect(userRoute()).toMatchObject({ userId: '123' })
})

test('search params transform', () => {
  const userRoute = reatomRoute({
    path: 'user',
    search: z
      .object({ u: z.string().optional() })
      .transform((raw) => ({ userId: raw.u })),
  })

  urlAtom.go('/user?u=123')
  expect(userRoute()).toMatchObject({ userId: '123' })
})

test('pathful callback child unmatches when sibling is active', async () => {
  const projectsRoute = reatomRoute('projects/:projectId')
  const reviewRoute = projectsRoute.reatomRoute({
    path: 'review',
    params: (input) => input,
  })
  const settingsRoute = projectsRoute.reatomRoute({
    path: 'settings',
    params: (input) => input,
  })

  reviewRoute.go({ projectId: '123' })
  await wrap(sleep())

  expect(reviewRoute()).toEqual({ projectId: '123' })
  expect(settingsRoute()).toBeNull()

  settingsRoute.go({ projectId: '123' })
  await wrap(sleep())

  expect(reviewRoute()).toBeNull()
  expect(settingsRoute()).toEqual({ projectId: '123' })
})

test('optional path param undefined omits segment', () => {
  const postRoute = reatomRoute('posts/:postId?')
  postRoute.go({ postId: undefined })
  expect(urlAtom().pathname).toBe('/posts')
})

test('pathless nested route does not treat prefix path as parent subpath', () => {
  const authRoute = reatomRoute('auth')
  const authDialogRoute = authRoute.reatomRoute({
    search: z.object({ dialog: z.enum(['a', 'b']).optional() }),
  })

  urlAtom.go('/auth-dialog')
  authDialogRoute.go({ dialog: 'a' })
  expect(urlAtom().pathname).toBe('/auth')
  expect(urlAtom().search).toBe('?dialog=a')
})

test('go.relative navigates from sibling using parent params', async () => {
  const projectsRoute = reatomRoute('projects/:projectId', 'rel.projects')
  const settingsRoute = projectsRoute.reatomRoute('settings', 'rel.settings')
  const reviewRoute = projectsRoute.reatomRoute('review', 'rel.review')

  settingsRoute.go({ projectId: '123' })
  await wrap(sleep())

  expect(urlAtom().pathname).toBe('/projects/123/settings')

  reviewRoute.go.relative()
  await wrap(sleep())

  expect(urlAtom().pathname).toBe('/projects/123/review')
})

test('go.relative merges explicit child params over parent', async () => {
  const orgRoute = reatomRoute('org/:orgId', 'rel.org')
  const teamRoute = orgRoute.reatomRoute('team/:teamId', 'rel.team')
  const memberRoute = orgRoute.reatomRoute('member/:memberId', 'rel.member')

  teamRoute.go({ orgId: 'o1', teamId: 't9' })
  await wrap(sleep())

  expect(urlAtom().pathname).toBe('/org/o1/team/t9')

  memberRoute.go.relative({ memberId: 'm3' })
  await wrap(sleep())

  expect(urlAtom().pathname).toBe('/org/o1/member/m3')
})

test('go.relative throws when parent is not matched', () => {
  const projectsRoute = reatomRoute('projects/:projectId')
  const reviewRoute = projectsRoute.reatomRoute('review')

  urlAtom.go('/')
  expect(() => reviewRoute.go.relative()).toThrow('not matched')
})

test('nested route schema preserves parent params after validation', async () => {
  const integrationId = '550e8400-e29b-41d4-a716-446655440000'

  const integrationsListRoute = reatomRoute('integrations')
  const integrationsDetailsRoute = integrationsListRoute.reatomRoute({
    path: ':id',
    params: z.object({ id: z.uuid() }),
  })
  const integrationsDetailsTypeRoute = integrationsDetailsRoute.reatomRoute({
    path: ':type',
    params: z.object({
      type: z.enum(['foo', 'bar']),
    }),
    async loader({ id, type }) {
      expect(id).toBe(integrationId)
      expect(type).toBe('foo')
    },
  })

  integrationsDetailsTypeRoute.go({ id: integrationId, type: 'foo' })
  await wrap(sleep())

  expect(integrationsDetailsRoute()).toEqual({ id: integrationId })
  expect(integrationsDetailsTypeRoute()).toEqual({
    id: integrationId,
    type: 'foo',
  })

  urlAtom.go(`/integrations/${integrationId}/bar`)
  await wrap(sleep())

  expect(integrationsDetailsTypeRoute()).toEqual({
    id: integrationId,
    type: 'bar',
  })

  urlAtom.go(`/integrations/not-a-uuid/foo`)
  await wrap(sleep())

  expect(integrationsDetailsRoute()).toBe(null)
  expect(integrationsDetailsTypeRoute()).toBe(null)
})

test('loader should not cached without params', async () => {
  const rootRoute = reatomRoute({ layout: true })

  const childRouteLoader = vi.fn(async () => {})
  const childRoute = rootRoute.reatomRoute({
    path: 'child',
    loader: childRouteLoader,
  })

  childRoute.loader.subscribe()
  expect(childRouteLoader).not.toHaveBeenCalled()

  childRoute.go()
  await wrap(Promise.resolve())
  expect(childRouteLoader).toHaveBeenCalled()
  expect(childRouteLoader).toHaveBeenCalledTimes(1)

  urlAtom.go('/some')
  await wrap(Promise.resolve())
  childRoute.go()
  await wrap(Promise.resolve())
  expect(childRouteLoader).toHaveBeenCalledTimes(2)
})
