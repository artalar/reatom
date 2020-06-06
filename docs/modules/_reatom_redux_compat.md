# Module: @reatom/redux-compat

Rreatom helpers to simplify moving from redux to reatom

## Index

### Functions

- [useStore](_reatom_redux_compat.md#markdown-header-const-usestore)

## Functions

### <a id="markdown-header-const-usestore" name="markdown-header-const-usestore"></a> useStore

A hook to access the reatom store.

**`example`**

import React from 'react'
import { useStore } from '@reatom/react'

export const ExampleComponent = () => {
const store = useStore()
return <div>{JSON.stringify(store.getState())}</div>
}
