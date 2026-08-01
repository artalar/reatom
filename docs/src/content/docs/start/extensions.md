---
title: Extensions
description: Add reusable behavior to atoms and actions with Reatom extensions
---

Extensions are **powerful add-ons** that enhance your atoms and actions with common functionality. Instead of writing the same patterns over and over, extensions provide ready-made solutions for async operations, persistence, caching, and much more.

The beauty of extensions is that they compose perfectly - you can combine multiple extensions on the same atom to get exactly the behavior you need.

Let's rewrite the data loading example from the [actions](/start/actions/) section using extensions, which add async tracking:

```ts /withAsyncData(?:(.+}))?/ title="src/model.ts"
import { atom, action, withAsyncData } from '@reatom/core'

const fetchList = action(async (page: number) => {
  const response = await fetch(`/api/data?page=${page}`)
  return await response.json()
}, 'fetchList').extend(withAsyncData({ initState: [] }))

fetchList.ready() // `false` during the fetch
fetchList.data() // the fetch result
fetchList.error() // `Error` or `undefined`, depends on the fetch result

// Use it in the same way
fetchList(1) // Promise
```

Some extensions can be used only with atoms (like `withMemo`), some only with actions (like `withCallHook`), but many extensions can be used with both!

## withAsyncData

Let's explore the list loading further. What if we want to add more parameters to the fetching? We could add another argument and pass it through the calling chain, but let's make it more reliable using the Reatom approach with implicit reactive coupling.

<!-- prettier-ignore -->
```ts /page\\(\\)|search\\(\\)/ title="src/model.ts"
import { atom, computed, withAsyncData } from '@reatom/core'

const search = atom('', 'search')
const page = atom(1, 'page')

const listResource = computed(async () => {
  const response = await fetch(`/api/data?search=${search()}&page=${page()}`)
  return await response.json()
}, 'listResource').extend(withAsyncData({ initState: [] }))
```

Notice how we reduce the amount of code and make the entire flow more optimal! `listResource` is an async computed that reruns only when `page` or `search` changes and **when the data is needed**. By using a computed, we make the effect lazy, meaning it will run only when `listResource.ready()`, `listResource.data()`, or `listResource.error()` is called and used in a component or effect.

## withSearchParams

Let's enhance our extension system further. We have a few improvements to make:

- Let's sync the parameters with URL search parameters
- Let's reset the page state when search changes
- Let's add handy actions for pagination

<!-- prettier-ignore -->
```ts /withSearchParams\\(|withComputed\\(/ title="src/model.ts"
import { atom, withSearchParams, withComputed, isInit, computed, withAsyncData } from '@reatom/core'

const search = atom('', 'search').extend(withSearchParams('search'))
const page = atom(1, 'page').extend(
  withSearchParams('page'),
  withComputed((state) => {
    search() // subscribe to the search changes
    // do NOT reset the persisted state on init
    return isInit() ? state : 1
  }),
  target => ({
    next: () => target.set(state => state + 1),
    prev: () => target.set(state => Math.max(1, state - 1)),
  })
)

const listResource = computed(async () => {
  const response = await fetch(`/api/data?search=${search()}&page=${page()}`)
  return await response.json()
}, 'listResource').extend(withAsyncData({ initState: [] }))
```

Perfect! That's quite comprehensive. In any other framework or library, implementing this seemingly simple logic would be much more complex, but Reatom provides all the utilities you need to solve it elegantly.

Let's examine how to use this loading model in a component.

## Framework bindings

Now let's connect our reactive model to the UI using `reatomComponent`. This is a regular React component enhanced with computed capabilities - it automatically tracks atom dependencies and triggers re-renders only when subscribed atoms change, ensuring optimal performance. You can call atoms directly as functions and use their actions just like regular functions - no hooks required, no restrictions on conditional logic or loops. At the same time, you can use regular React hooks, accept props, and do anything you would normally do in a React component.

```tsx title="src/Results.tsx" /page.next|page.prev|(?:page|ready|data|search)()|search.set(.+)/
import React from 'react'
import { reatomComponent } from '@reatom/react'
import { search, page, listResource } from './model'

const Filters = reatomComponent(() => (
  <div>
    <input
      value={search()}
      onChange={(e) => search.set(e.target.value)}
      placeholder="Search..."
    />
    <div>
      <button onClick={page.prev}>Previous</button>
      <span> {page()}</span>
      <button onClick={page.next}>Next</button>
    </div>
  </div>
))

const List = reatomComponent(() => (
  <section>
    <Filters />
    {listResource.ready() || <div>Loading...</div>}
    <ul>
      {listResource.data().map((item, index) => (
        <li key={index}>{/* render your item */}</li>
      ))}
    </ul>
  </section>
))
```

## Conclusion

One of the key features of `withAsyncData` is that it automatically aborts the previous request when a new one is initiated. So when a user types quickly in the search field and triggers multiple requests, only the most recent one will be processed!

> You can dive deeper into the rabbit hole of concurrency management in the [async context](/handbook/async-context/) article.

However, when you need to _put_ / _post_ data, you don't need the autoabort strategy and the result data storing, for this cases you should use `withAsync` extension for your async actions, which only tracks the loading status and possible errors.

Reatom ecosystem has a lot of other extensions, try to search the docs! But sometimes, you need a little more, not an extension for one atom or actions, but a factory to build a set of complex models. Check the next section to learn about form management!
