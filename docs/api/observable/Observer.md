# Observer

```typescript
interface Observer<T> {
  start?(subscription: Subscription): void
  next(value: ActionOrValue<T>): void
  error?(errorValue: string): void
  complete?(): void
}
```
