import { genIdFromLine, configureGenIdFromLine } from '../src/genIdFromLine'
import { declareAtom, declareAction, setNameToId, getTree } from '@reatom/core'

describe('@reatom/debug', () => {
  describe('genIdFromLine', () => {
    test('genIdFromLine', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine)
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe('pep [/debug/test/index.ts:12:48]')
        expect(getTree(atom).id).toBe('dd [/debug/test/index.ts:13:44]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configureGenIdFromLine', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine)
        configureGenIdFromLine({
          pathMaxDeep: 4,
        })
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe(
          'pep [/packages/debug/test/index.ts:26:48]',
        )
        expect(getTree(atom).id).toBe(
          'dd [/packages/debug/test/index.ts:27:44]',
        )
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
  })
})
