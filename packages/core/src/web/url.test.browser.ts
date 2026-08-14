import { beforeEach, expect, test } from 'test'

import { wrap } from '../methods'
import { sleep } from '../utils'
import { urlAtom } from './url'

beforeEach(() => {
  urlAtom.routes = {}
  document.body.innerHTML = ''
  if (window.location.href !== 'http://localhost/') {
    window.history.replaceState({}, '', '/')
  }
})

test.skip('urlAtom synchronizes history immediately', () => {
  urlAtom.go('/history-sync')

  expect(urlAtom().pathname).toBe('/history-sync')
  expect(window.location.pathname).toBe('/history-sync')
})

test('catchLinks dispatches hashchange for same-page anchors', async () => {
  const hashChanges: Array<string> = []
  const trackHashChange = () => hashChanges.push(window.location.hash)
  window.addEventListener('hashchange', trackHashChange)

  try {
    document.body.innerHTML = '<a id="hash-link" href="#section">section</a>'
    urlAtom.catchLinks.set(true)
    urlAtom.init()

    const link = document.getElementById('hash-link')
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error('Expected hash link element')
    }

    link.click()
    await wrap(sleep())

    expect(window.location.hash).toBe('#section')
    expect(hashChanges).toEqual(['#section'])
  } finally {
    window.removeEventListener('hashchange', trackHashChange)
    document.body.innerHTML = ''
  }
})
