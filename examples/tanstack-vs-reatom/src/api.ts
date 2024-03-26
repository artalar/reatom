import { sleep } from '@reatom/framework'
import { Octokit } from 'octokit'

const octokit = new Octokit({
  auth: import.meta.env.VITE_GITHUB_TOKEN,
})

export const getIssues = async (
  options: {
    owner: string
    repo: string
    page: number
  },
  request?: Partial<Request>,
) => {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues', {
      ...options,
      per_page: 10,
      request,
    })
    const total = data.length === 10 ? options.page + 1 : options.page

    request?.signal?.throwIfAborted()

    return { data, total }
  } finally {
    await sleep(500)
  }
}
