# Changelog

## v2

- Atoms state is no longer autocleaning after dependent subscriptions clear.
  > It use `WeakMap` so it is safe to memory leaks and more predictable (intuitive)
- Atoms may receive actions ever they have no any dependent subscriptions, if action includes link to atom/s in `target` field.
  > It used in atoms "methods"
