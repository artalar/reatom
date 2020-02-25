import { declareAction, declareAtom, setNameToId, getTree } from '../src/index'
import { nameToId } from '../src/shared'

describe('@reatom/core', () => {
  describe('shared', () => {
    test('setNameToId', () => {
      setNameToId(name => `${name}10`)
      const at = declareAtom('pep', {}, () => {})
      const act = declareAction('peps')

      expect(nameToId('a')).toBe('a10')
      expect(getTree(at).id).toBe('pep10')
      expect(getTree(act).id).toBe('peps10')
    })
  })
})
