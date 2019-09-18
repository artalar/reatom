import { declareAction, declareAtom, setNameToId, getTree } from '../index'
import { nameToId } from '../shared'

describe('@reatom/core', () => {
  describe('shared', () => {
    test('setNameToId', () => {
      setNameToId(name => name + '10')
      const at = declareAtom('pep', {}, () => {})
      const act = declareAction('peps')

      expect(nameToId('a')).toBe('a10')
      expect(getTree(at).id).toBe('pep10')
      //@ts-ignore
      expect(getTree(act).id).toBe('peps10')
    })
  })
})
