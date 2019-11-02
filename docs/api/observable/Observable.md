# Observable

```typescript
type ActionOrValue<T> = T extends undefined ? Action<any, string> : T

interface Observable<T> {
  /**
   * Subscribes observer for Store or Atom<T> updates
   *
   * @return {Subscription}
   */
  subscribe(observer: Observer<T>): Subscription
  /**
   * Subscribes onNext handler for Store or Atom<T> updates
   *
   * @param onNext called when action dispatched or atom state changed
   * @param onError will never be called
   * @param onComplete will never be called
   * @return {Subscription}
   */
  subscribe(
    onNext: (value: ActionOrValue<T>) => void,
    onError?: Function,
    onComplete?: Function,
  ): Subscription

  [Symbol.observable](): Observable<T>
}
```
