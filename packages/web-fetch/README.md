# `@reatom/web-fetch`

Simple HTTP client for Reatom.

## Installation

```sh
npm i @reatom/web-fetch
```

## Usage

`reatomFetch` creates an async action for fetching data from a HTTP resource:

```ts
const getMe = reatomFetch<User>('/api/me')

await getMe(ctx) // Promise<User>
```

By default, it parses the response as JSON.

You may provide a config object instead of an URL string:

```ts
const getMe = reatomFetch<User>({
  url: '/api/me',
})
```

To configure the request dynamically, pass a function that returns the configuration:

```ts
const getUser = reatomFetch<User, string>((ctx, id) => `/api/user/${id}`)

const search = reatomFetch<SearchItem[], string, 'price' | 'orders'>((ctx, filter, sortBy) => ({
  url: '/api/search',
  params: { filter, sortBy },
}))
```

To specify the request method, either use the `method` option or `reatomFetch.<method>` shorthand:

```ts
const postUser = reatomFetch<User, User>((ctx, body) => ({
  method: 'post',
  url: `/api/user/${id}`,
  body,
}))

const postUser = reatomFetch.post<User, User>((ctx, body) => ({
  url: `/api/user/${id}`,
  body,
}))
```

To have some common options application-wide, create a custom `reatomFetch` instance using `createReatomFetch`:

```ts
export const reatomFetch = createReatomFetch({
  // client defaults
})
```

The default client options are stored in `createReatomFetch.defaults`.

## Options

### `transport`

A fetch-like function that is called by the client. Defaults to `globalThis.fetch`.

### `method`

HTTP method of the request. Ignored if using a `reatomFetch.<method>` shorthand.

### `url`

If `urlBase` option is defined, this should be the last part of the path component of the request URL. Otherwise, this should be an URL string without query and hash components.

Using a string as a config object is identical to `{url: thatString}` object.

### `urlBase`

May be a base URL string of the request. Defaults to `globalThis.location?.toString()`.

### `params`

Query params dictionary.

### `body`

Raw request body, automatically passed through `serializeBody` option.

### `headers`

A `HeadersInit` value specifying the request headers.

### `headersBase`

Default headers specified at the client level. Defaults to `Accept: application/json`.

### `init`

A `RequestInit` object without properties managed by the client.

### `parseResponse`

Validate and parse a `Response` object.

By default, ensures that the status code is 2XX and `content-type` is `application/json`, and parses the body as JSON.

### `serializeBody`

Defaults to `JSON.stringify`.

## NodeJS

Though the package has `web` in its name, it should work fine in NodeJS as long as you set `urlBase` in your client's options. For older versions you should also set the `transport` option to the `undici` implementation.
