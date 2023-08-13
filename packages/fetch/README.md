# `@reatom/web-fetch`

A typed HTTP client for Reatom.

## Installation

```sh
npm i @reatom/fetch
```

## Usage

TODO: requires expansion

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

It's also possible to generate the config dynamically based on a parameter. In TypeScript, you should specify its type by supplying second generic parameter to `reatomFetch`:

```ts
const getUser = reatomFetch<User, [string]>((id) => `/api/users/${id}`)

await getUser(ctx, 'krulod')
```

To specify the request method, either use the `method` option or `reatomFetch.<method>` shorthand:

```ts
const postUser = reatomFetch<User, [string]>((id) => ({
  method: 'post',
  url: `/api/users/${id}`,
}))

const postUser = reatomFetch.post<User, [string]>((id) => `/api/users/${id}`)
```

A particularly handy feature of `reatomFetch` is chain-like configuration. The function returned from `reatomFetch` and the method shorthands (the query) can be used to create derived queries that :

```ts
const fetchUser = reatomFetch<User, [string]>((id) => `/api/users/${id}`)

const postUser = fetchUser.post<User, string>((displayName) => ({
  body: { displayName },
}))

const fetchUserFriends = fetchUser.get<User[], boolean | void>(
  `/friends`,
  (mutual = false) => ({
    params: { mutual },
  }),
)

await postUser(ctx, 'krulod', 'Valerii')
await fetchUserFriends(ctx, 'krulod')
```

The default client options are stored in `typedFetchDefaults`.

## Options

### `transport`

A fetch-like function that is called by the client. Defaults to `globalThis.fetch`.

### `method`

HTTP method of the request. Ignored if using a `reatomFetch.<method>` shorthand.

### `url`

Path component of the request URL.

Using a string as a config object is identical to `{url: thatString}` object.

Merged by concatenation, for instance, merging `/api/` and `/me/` results in `/api/me`.

### `origin`

Absolute request URL. Defaults to `globalThis.location?.toString()`.

### `params`

Search parameters of the request URL, serialized automatically with `getParams`.

### `body`

Raw request body, serialized automatically with `getBody`.

### `headers`

A `HeadersInit` value specifying the request headers.

### `requestInit`

A `RequestInit` object without properties managed by the client.

### `getParams`

Convert the value of `params` to a `UrlSearchParamsInit` value.

### `getResult`

Validate and parse the response.

By default, ensures that the status code is 2XX and `content-type` is `application/json`, and parses the body as JSON.

### `getBody`

Convert the value of `body` to a `BodyInit` value. Defaults to return class instances as-is and to `JSON.stringify` plain objects, arrays and primitives.

## Usage in non-browser environments

In environments without `globalThis.location`, all queries must have `origin` option provided.

## Usage without Reatom

If you are not using Reatom yet, you may be interested in the module `reatomFetch` is built upon: `typedFetch`. It's mostly identical to `reatomFetch` except for the integration with `@reatom/async` in the latest.
