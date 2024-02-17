import { parseHTML } from 'linkedom'

export const createWindow = () => {
  const window = parseHTML(`
    <!doctype html>
    <html>
      <head></head>
      <body></body>
    </html>
  `)

  // crutch: https://github.com/WebReflection/linkedom/issues/252
  const Text = new Proxy(window.Text, {
    construct(_, [value = '']) {
      return window.document.createTextNode(value)
    },
  })

  // linkedom `window` can't just be spreaded - add fields manually as needed
  return {
    document: window.document,
    Node: window.Node,
    Text,
    Element: window.Element,
  }
}
