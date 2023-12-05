import mermaid from 'mermaid'

mermaid.initialize({
  theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'pastel',
})

export { mermaid }
