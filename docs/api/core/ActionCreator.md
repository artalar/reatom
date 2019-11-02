# ActionCreator

Function for crating action packages

```ts
interface ActionCreator {
  (): Action<T>,
  getType(): string
}
```
