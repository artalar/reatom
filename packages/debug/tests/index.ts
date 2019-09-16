import { genIdFromLine } from '../src/genIdFromLine';
describe('@reatom/debug', () => {
  describe('genIdFromLine', () => {
    test('genIdFromLine', () => {
      expect(genIdFromLine("a")).toBe('a')
      expect(genIdFromLine(["b"])).toBe('b')
    })
  })
})
