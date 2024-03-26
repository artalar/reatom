export interface Issue {
  repository_url: string
  labels_url: string
  comments_url: string
  events_url: string
  html_url: string
  number: number
  title: string
  user: any
  labels: object[]
  state: string
  locked: string
  assignees: object[]
  milestone: { url: string }
  comments: 2
  author_association: string
  body: string
  created_at: string
  closed_by: object
}

export const searchIssues = async (config: {
  query: string
  controller: AbortController
}) => {
  const response = await fetch(
    `https://api.github.com/search/issues?q=${config.query}&page=1&per_page=10`,
    { signal: config.controller.signal },
  )
  if (response.status !== 200) {
    const error = new Error()
    throw Object.assign(error, await response.json())
  }
  return (await response.json()) as { items: Issue[] }
}
