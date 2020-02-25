import { declareAtom, declareAction, setNameToId, getTree } from '@reatom/core'
import { genIdFromLine } from '../src/genIdFromLine'

describe('@reatom/debug', () => {
  describe('genIdFromLine', () => {
    test('genIdFromLine', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine())
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe('pep [/debug/test/index.ts:12:48]')
        expect(getTree(atom).id).toBe('dd [/debug/test/index.ts:13:44]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configureGenIdFromLine maxDeep', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            pathMaxDeep: 4,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe(
          'pep [/packages/debug/test/index.ts:25:48]',
        )
        expect(getTree(atom).id).toBe(
          'dd [/packages/debug/test/index.ts:26:44]',
        )
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configureGenIdFromLine showColumn', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            showColumn: false,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe('pep [/debug/test/index.ts:38]')
        expect(getTree(atom).id).toBe('dd [/debug/test/index.ts:39]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configureGenIdFromLine fullPath', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            useFullPath: true,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(
          action.getType().includes('/packages/debug/test/index.ts:51:48'),
        ).toBe(true)
        expect(
          getTree(atom).id.includes('/packages/debug/test/index.ts:52:44'),
        ).toBe(true)
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
  })
})
