const definitions = {
  source: '@reatom/core',
  declareAtom: 'declareAtom',
  declareAction: 'declareAction',
  map: 'map',
  combine: 'combine',
  names: ['declareAtom', 'declareAction', 'map', 'combine'],
}

/*
  Inspired with zerobias/effector
  Thanks @zerobias and @goodmind for implementation example
  https://www.npmjs.com/package/effector
*/
module.exports = function babelPlugin(babel) {
  const { types: t } = babel

  const plugin = {
    name: '@reatom/babel-plugin',
    pre() {
      this.importedNames = new Map()
    },
    visitor: {
      ImportDeclaration(path) {
        const {
          source: { value: source },
          specifiers,
        } = path.node
        if (source !== definitions.source) {
          return
        }
        for (let i = 0; i < specifiers.length; i++) {
          const s = specifiers[i]
          if (!s.imported) continue
          const importedName = s.imported.name
          const localName = s.local.name
          if (definitions.names.includes(importedName)) {
            this.importedNames.set(localName, importedName)
          }
        }
      },
      CallExpression(path) {
        if (!t.isIdentifier(path.node.callee)) {
          return
        }
        if (this.importedNames.has(path.node.callee.name)) {
          const name = this.importedNames.get(path.node.callee.name)
          const id = findCandidateNameForExpression(path)
          if (id) {
            pushNameToArgs(path, id, t, name)
          }
        }
      },
    },
  }
  return plugin
}

function findCandidateNameForExpression(path) {
  let id
  path.find(subPath => {
    if (subPath.isAssignmentExpression()) {
      id = subPath.node.left
    } else if (subPath.isObjectProperty()) {
      id = subPath.node.key
    } else if (subPath.isVariableDeclarator()) {
      id = subPath.node.id
    } else if (subPath.isStatement()) {
      return true
    }

    return id || false
  })
  return id
}

function pushNameToArgs(path, nameNodeId, t, name) {
  const displayName = nameNodeId.name

  if (!displayName) {
    return
  }
  const callExp = path.find(subPath => subPath.isCallExpression())

  if (!callExp) {
    return
  }
  const {
    node: { arguments: args },
  } = callExp

  switch (name) {
    case definitions.map:
    case definitions.declareAtom:
      if (args.length === 2) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
    case definitions.declareAction:
      if (
        args.length === 0 ||
        !['TemplateLiteral', 'StringLiteral', 'ArrayExpression'].includes(
          args[0].type,
        )
      ) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
    case definitions.combine:
      if (args.length === 1) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
    default:
      break
  }
}
