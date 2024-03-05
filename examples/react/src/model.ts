import {
  atom,
  reatomResource,
  withDataAtom,
  withErrorAtom,
  withReset,
  withStatusesAtom,
} from '@reatom/framework'
import { octokit, withSignal } from './octokit'
import { components } from '@octokit/openapi-types'

export const RepoIdDefault = 'artalar/reatom'

export const repoId = atom('', 'repoId')

export const repoOwner = atom((ctx) => {
  return (ctx.spy(repoId) || RepoIdDefault).split('/')[0]
}, 'repoOwner')

export const repoName = atom((ctx) => {
  return (ctx.spy(repoId) || RepoIdDefault).split('/')[1]
}, 'repoName')

export const issuesPage = atom(1, 'issuesPage').pipe(withReset())

export const issuesPerPage = atom(10, 'issuesPerPage')

repoId.onChange((ctx) => {
  issuesPage.reset(ctx)
})

export const repository = reatomResource(async (ctx) => {
  const owner = ctx.spy(repoOwner)
  const repo = ctx.spy(repoName)

  const resp = await ctx.schedule(() => {
    return octokit.rest.repos.get({
      owner,
      repo,
    })
  })
  return resp.data
}).pipe(withDataAtom(), withErrorAtom())

export const issuesOpenCount = atom((ctx) => {
  return ctx.spy(repository.dataAtom)?.open_issues_count || 0
})

export const issues = reatomResource(async (ctx) => {
  const perPage = ctx.spy(issuesPerPage)
  const page = ctx.spy(issuesPage)
  const owner = ctx.spy(repoOwner)
  const repo = ctx.spy(repoName)

  const resp = await ctx.schedule(() => {
    return octokit.rest.issues.listForRepo({
      ...withSignal(ctx.controller.signal),
      per_page: perPage,
      page,
      owner,
      repo,
    })
  })
  return resp.data
}, 'issues').pipe(withDataAtom(), withErrorAtom(), withStatusesAtom())

export type Issue = components['schemas']['issue']
