export const fetchIssues = (query: string, controller: AbortController) =>
  fetch(
    `https://api.github.com/search/issues?q=${query}&page=${1}&per_page=10`,
    controller,
  ).then<{ items: Array<{ title: string }> }>(async (r) => {
    if (r.status !== 200) throw new Error(await r.text())
    return r.json()
  })
