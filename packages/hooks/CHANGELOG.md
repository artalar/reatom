# Changelog

## [3.4.0](https://github.com/artalar/reatom/compare/hooks-v3.3.1...hooks-v3.4.0) (2023-04-18)


### Features

* **hooks:** handle lensed atoms in onUpdate ([c296746](https://github.com/artalar/reatom/commit/c2967468b574446100f6729f089ecf4e5d1490de))


### Bug Fixes

* **hooks:** _onUpdate ([fed4037](https://github.com/artalar/reatom/commit/fed40372ef6ee530a4d9df5d0924b0aaaa7d235f))
* **hooks:** use utils isAbort ([1361663](https://github.com/artalar/reatom/commit/1361663aae8bff32f8b1fe96948222def408936a))

## [3.3.0](https://github.com/artalar/reatom/commit/c2967468b574446100f6729f089ecf4e5d1490de) (2023-04-12)

**feat(hooks): handle lensed atoms in onUpdate**

You could write now `onUpdate(anAtom.pipe(filter), cb)`

The second callback is optional now and you could use it in a pipe `anAtom.pipe(effect(() => {...}), onUpdate)` - this chains is active now and will react to `anAtom` updates
