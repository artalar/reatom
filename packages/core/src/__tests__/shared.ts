import { declareAction, declareAtom, setNameToId } from '../index'
import { nameToId, TREE } from '../shared'
describe('@reatom/core', () => {
  describe('shared', () => {
    test('setNameToId', () => {
      // @ts-ignore
      setNameToId(name => name + 10)
      const at = declareAtom('pep', {}, () => {})
      const act = declareAction('peps')

      expect(at[TREE].id).toBe('pep10')
      expect(act[TREE].id).toBe('peps10')
      expect(nameToId('a')).toBe('a10')
    })
  })
})
