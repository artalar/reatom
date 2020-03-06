import { declareAtom, declareAction, setNameToId, getTree } from '@reatom/core'
import { genIdFromLine } from '../src/genIdFromLine'

describe('@reatom/debug', () => {
  describe('genIdFromLine', () => {
    test('basic', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine())
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe('pep [/debug/test/index.ts:12:48]')
        expect(getTree(atom).id).toBe('dd [/debug/test/index.ts:13:44]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('symbol', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(genIdFromLine())
        const atom = declareAtom(Symbol('42'), 0, () => {})

        expect(getTree(atom).id).toBe('42 [/debug/test/index.ts:23:44]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configure maxDeep', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            pathMaxDeep: 4,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe(
          'pep [/packages/debug/test/index.ts:34:48]',
        )
        expect(getTree(atom).id).toBe(
          'dd [/packages/debug/test/index.ts:35:44]',
        )
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configure showColumn', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            showColumn: false,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(action.getType()).toBe('pep [/debug/test/index.ts:47]')
        expect(getTree(atom).id).toBe('dd [/debug/test/index.ts:48]')
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
    test('configure fullPath', () => {
      function mySexyFunctionWhereImDeclaredMySexyAtomsAndActions() {
        setNameToId(
          genIdFromLine({
            useFullPath: true,
          }),
        )
        const action = declareAction('pep')
        const atom = declareAtom('dd', 0, () => {})

        expect(
          action.getType().includes('/packages/debug/test/index.ts:60:48'),
        ).toBe(true)
        expect(
          getTree(atom).id.includes('/packages/debug/test/index.ts:61:44'),
        ).toBe(true)
      }
      mySexyFunctionWhereImDeclaredMySexyAtomsAndActions()
    })
  })
})
