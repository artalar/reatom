const definions = {
  source: '@reatom/core',
  declareAtom: 'declareAtom',
  declareAction: 'declareAction',
  map: 'map',
  combine: 'combine',
  names: ['declareAtom', 'declareAction', 'map', 'combine'],
}

module.exports = function(babel) {
  const { types: t } = babel

  const importedNames = new Map()

  const plugin = {
    name: '@reatom/babel-plugin',
    visitor: {
      ImportDeclaration(path) {
        const {
          source: { value: source },
          specifiers,
        } = path.node
        if (source != definions.source) {
          return
        }
        for (let i = 0; i < specifiers.length; i++) {
          const s = specifiers[i]
          if (!s.imported) continue
          const importedName = s.imported.name
          const localName = s.local.name
          if (definions.names.includes(importedName)) {
            importedNames.set(localName, importedName)
          }
        }
      },
      CallExpression(path) {
        if (!t.isIdentifier(path.node.callee)) {
          return
        }
        if (importedNames.has(path.node.callee.name)) {
          const name = importedNames.get(path.node.callee.name)
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

// https://github.com/zerobias/effector/blob/1d51ccc59df2de6965a75e4b9c9ea2e8dd572fd8/src/babel/babel-plugin.js#L209
function findCandidateNameForExpression(path) {
  let id
  path.find(path => {
    if (path.isAssignmentExpression()) {
      id = path.node.left
    } else if (path.isObjectProperty()) {
      id = path.node.key
    } else if (path.isVariableDeclarator()) {
      id = path.node.id
    } else if (path.isStatement()) {
      return true
    }

    if (id) return true
  })
  return id
}

function pushNameToArgs(path, nameNodeId, t, name) {
  const displayName = nameNodeId.name

  if (!displayName) {
    return
  }
  const callExp = path.find(path => path.isCallExpression())

  if (!callExp) {
    return
  }
  const {
    node: { arguments: args },
  } = callExp
  switch (name) {
    case definions.map:
    case definions.declareAtom:
      if (args.length === 2) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
    case definions.declareAction:
      if (
        args.length === 0 ||
        (args[0].type !== 'StringLiteral' && args[0].type !== 'ArrayExpression')
      ) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
    case definions.combine:
      if (args.length === 1) {
        args.unshift(t.stringLiteral(displayName))
      }
      break
  }
}
