import {throwReatomError} from '@reatom/core'
import {Plain} from '@reatom/utils'

export type TypedFetchFactory<Args extends any[] = []> = {
  <T>(init?: TypedFetchInit<T>): TypedFetchQuery<T, Args>
  <T, Arg>(init: TypedFetchInitFn<T, Arg>): TypedFetchQuery<T, [...Args, Arg]>
}

export type TypedFetchInits = TypedFetchInitFn[]

export type TypedFetchInit<T = unknown> = string | TypedFetchConfig<T>

export type TypedFetchInitFn<T = unknown, Arg = unknown> =
  | TypedFetchInit<T>
  | ((arg: Arg) => TypedFetchInit<T>)

export type TypedFetchQuery<T, Args extends any[] = []> = ((
  ...args: Args
) => Promise<T>) &
  Plain<Record<TypedFetchMethod | 'createFetch', TypedFetchFactory<Args>>>

export type TypedFetchConfig<T> = {
  url?: string
  origin?: string
  method?: TypedFetchMethod | (string & {})
  headers?: HeadersInit
  requestInit?: Omit<RequestInit, 'signal' | 'method' | 'body' | 'headers'>
  signal?: AbortSignal
  body?: unknown
  params?: unknown
  getResult?: (response: Response) => T | Promise<T>
  getParams?: (params: unknown) => UrlSearchParamsInit
  getBody?: (body: unknown) => BodyInit
  transport?: (url: string, init: RequestInit) => Response | Promise<Response>
}

export type UrlSearchParamsInit = ConstructorParameters<
  typeof URLSearchParams
>[0]

export type TypedFetchMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export const TYPED_FETCH_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
] as const satisfies readonly TypedFetchMethod[]

export const typedFetch = <T, Args extends any[] = []>(
  ...inits: [init: TypedFetchInit<T>] | TypedFetchInits
) => {
  const query = async (...args: Args) => {
    const config: TypedFetchConfig<T> = {}
    let arg = 0
    let params = new URLSearchParams()

    for (let init of [typedFetchDefaults, ...inits]) {
      if (typeof init === 'function') init = init(args[arg++])
      if (typeof init === 'string') init = {url: init}

      const {headers: headersPrev, url: urlPrev} = config

      for (const k in init) {
        const v = init[k as never]
        if (v !== undefined) config[k as never] = v
      }

      if (urlPrev && (init as any).url) {
        config.url =
          urlPrev.replace(/\/+$/, '') +
          '/' +
          (init as any).url.replace(/^\/+/, '')
      }

      if ((init as any).params !== undefined) {
        const next = new URLSearchParams(
          config.getParams!((init as any).params),
        )

        for (const [key, value] of next) {
          params.set(key, value)
        }
      }

      if (headersPrev && config.headers) {
        config.headers = new Headers(headersPrev)
        for (const [key, value] of new Headers(config.headers)) {
          config.headers.set(key, value)
        }
      }
    }

    const url = new URL(config.url!, config.origin)
    url.search = params.toString()

    return await config.getResult!(
      await config.transport!(url.toString(), {
        ...(config.requestInit ?? {}),
        method: config.method,
        signal: config.signal,
        headers: config.headers,
        body:
          config.body === undefined ? undefined : config.getBody!(config.body),
      }),
    )
  }

  const factory =
    (method?: string) =>
      (init: any = {}) =>
        typedFetch(...inits, init, {method})

  return Object.assign(
    query,
    {createFetch: factory()},
    Object.fromEntries(
      TYPED_FETCH_METHODS.map((method) => [method, factory(method)]),
    ),
  ) as any as TypedFetchQuery<T, Args>
}

export const typedFetchDefaults = {
  origin: globalThis.location?.toString(),
  transport: globalThis.fetch,
  method: 'get',
  headers: {Accept: 'application/json'},
  getResult(response) {
    throwReatomError(
      Math.floor(response.status / 100) - 2,
      `HTTP Error: ${response.statusText ?? response.status}`,
    )
    const ct = response.headers.get('Content-Type')
    throwReatomError(
      ct !== 'application/json',
      `Expected Content-Type to be "application/json", got "${ct}"`,
    )
    return response.json()
  },
  getParams: (x) => x as UrlSearchParamsInit,
  getBody: (body) =>
    body &&
      typeof body === 'object' &&
      Reflect.getPrototypeOf(body) &&
      !Array.isArray(body)
      ? (body as BodyInit)
      : JSON.stringify(body),
} satisfies TypedFetchConfig<unknown>
