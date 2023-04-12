# Changelog

## [3.3.0](https://github.com/artalar/reatom/commit/c2967468b574446100f6729f089ecf4e5d1490de) (2023-04-12)

**feat(hooks): handle lensed atoms in onUpdate**

You could write now `onUpdate(anAtom.pipe(filter), cb)`

The second callback is optional now and you could use it in a pipe `anAtom.pipe(effect(() => {...}), onUpdate)` - this chains is active now and will react to `anAtom` updates
