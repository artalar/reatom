# Module: @reatom/redux-compat

Rreatom helpers to simplify moving from redux to reatom

## Index

### References

- [useStore](_reatom_redux_compat.md#markdown-header-usestore)

### Functions

- [useStore](_reatom_redux_compat.md#markdown-header-const-usestore)

## References

### <a id="markdown-header-usestore" name="markdown-header-usestore"></a> useStore

• **useStore**:

## Functions

### <a id="markdown-header-const-usestore" name="markdown-header-const-usestore"></a> useStore

▸ **useStore**(): _[Store](_reatom_core.md#markdown-header-store)_

A hook to access the reatom store.

**`example`**

import React from 'react'
import { useStore } from '@reatom/react'

export const ExampleComponent = () => {
const store = useStore()
return <div>{JSON.stringify(store.getState())}</div>
}

**Returns:** _[Store](_reatom_core.md#markdown-header-store)_

the reatom store
