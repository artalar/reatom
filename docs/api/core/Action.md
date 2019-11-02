# Action

Action is a packet of data sent to the store for processing by atoms.

> See more info about [flux standard action](https://github.com/redux-utilities/flux-standard-action):

## Signature

```ts
type Reaction<T> = (payload: T, store: Store) => void

interface Action<T> {
  type: string,
  payload: Payload<T>,
  reactions?: Reaction<T>[]
}
```

## Examples

Basic

```js
{
  type: 'auth',
  payload: { user: 'Sergey' }
}
```

With reactions
```js
{
  type: 'auth',
  payload: { user: 'Sergey' },
  reactions: [
    payload => console.log(payload),
    payload => console.log(payload.user),
  ]
}
```
