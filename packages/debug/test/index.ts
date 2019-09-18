import { genIdFromLine } from '../src/genIdFromLine'
import { declareAtom, declareAction, setNameToId, getTree } from '@reatom/core'

describe('@reatom/debug', () => {
  describe('genIdFromLine', () => {
    test('genIdFromLine', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine)
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe(
          'pep [2][/packages/debug/test/index.ts#12]',
        )
        expect(getTree(atom).id).toBe(
          'dd [3][/packages/debug/test/index.ts#13]',
        )
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
  })
})
