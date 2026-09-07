---
title: Handling submission errors
description: Surface form submit failures, map API errors to fields, and keep UX predictable
---

We export the `resolveFieldByPath` utility from `@reatom/core`, which is used internally in the forms core to determine which field an error belongs to when thrown during standard schema validation.

Using this utility, you can efficiently handle validation errors coming from the backend, especially if the error format follows the `StandardSchemaV1.Issue` interface. In edge cases, you can transform backend responses to this format (for example, by splitting dot notation strings into the `path` from `StandardSchemaV1.Issue`, which is simply an array of error path segments).

Let's take this simple code as an example:

```ts
import { reatomForm, wrap } from '@reatom/core'
import { api } from 'api'

const registerForm = reatomForm(
  {
    login: '',
    password: '',
  },
  {
    onSubmit: async ({ login, password }) => {
      const response = await wrap(api.register({ login, password }))

      // Here response.errors will contain the errors.
      // Our task is to assign them to the corresponding fields.
    },
  },
)
```

### Standard Schema

We are based on this standard, so the integration will be the most straightforward.

```diff lang="ts" "resolveFieldByPath"
import { reatomForm, wrap, resolveFieldByPath } from '@reatom/core'
import { api } from 'api'

const registerForm = reatomForm({
    login: '',
    password: ''
}, {
    onSubmit: async ({ login, password }) => {
        const response = await wrap(api.register({ login, password }))

+        for(const error of response.errors) {
+            const field = resolveFieldByPath(error.path, registerForm.fields)
+            if(field) {
+                field.validation.errors.unshift({
+                    source: 'submission',
+                    message: field.message
+                })
+            }
+        }
    }
})
```

### TypeBox (Elysia)

This error output format requires a small transformation to the standard `path`:

```diff lang="ts" "toStandardSchemaIssuePath"
import { reatomForm, wrap, resolveFieldByPath } from '@reatom/core'
import { api } from 'api'

const toStandardSchemaIssuePath: (raw: string) => {
    return raw.split('/').filter(Boolean)
}

const registerForm = reatomForm({
    login: '',
    password: ''
}, {
    onSubmit: async ({ login, password }) => {
        const response = await wrap(api.register({ login, password }))

+        for(const error of response.errors) {
+            const field = resolveFieldByPath(
+                toStandardSchemaIssuePath(error.path),
+                registerForm.fields
+            )
+
+            if(field) {
+                field.validation.errors.unshift({
+                    source: 'submission',
+                    message: field.message
+                })
+            }
+        }
    }
})
```
