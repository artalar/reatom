import {
  Link,
  Stack,
  Table,
  TableBody,
  DataTableSkeleton,
  unstable_Pagination as Pagination,
  TableHead,
  TableRow,
  Tag,
  TableHeader,
  TableCell,
  TextInput,
} from '@carbon/react'

import './App.scss'
import { reatomComponent } from '@reatom/npm-react'
import * as model from './model'

export const App = reatomComponent(({ ctx }) => {
  const onPaginationChange = (event: any) => {
    model.issuesPage(ctx, event.page)
    model.issuesPerPage(ctx, event.pageSize)
  }

  const requestsSuccess =
    !ctx.spy(model.issues.errorAtom) && !ctx.spy(model.repository.errorAtom)
  const issuesPending = ctx.spy(model.issues.pendingAtom)

  return (
    <>
      <Stack orientation="vertical" gap={4}>
        <TextInput
          labelText={!!ctx.spy(model.repository.errorAtom)}
          id="repository-identifier"
          invalid={!!ctx.spy(model.repository.errorAtom)}
          invalidText={ctx.spy(model.repository.errorAtom)?.message}
          placeholder={model.RepoIdDefault}
          onChange={(event) => model.repoId(ctx, event.target.value || '')}
        />
        <div>
          <>
            {issuesPending ? (
              <DataTableSkeleton
                showHeader={false}
                rowCount={ctx.spy(model.issuesPerPage)}
                columnCount={5}
              />
            ) : requestsSuccess ? (
              <Table isSortable>
                <TableHead>
                  <TableRow>
                    <TableHeader>Number</TableHeader>
                    <TableHeader>State</TableHeader>
                    <TableHeader>Title</TableHeader>
                    <TableHeader>Opened by</TableHeader>
                    <TableHeader>Created at</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(ctx.spy(model.issues.dataAtom) ?? []).map((issue) => (
                    <TableRow key={issue.number}>
                      <TableCell>#{issue.number}</TableCell>
                      <TableCell>
                        <Tag type={issueStateColor(issue)}>{issue.state}</Tag>
                      </TableCell>
                      <TableCell>
                        <Link href={issue.html_url}>{issue.title}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={issue.user!.html_url}>
                          {issue.user!.login}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {new Date(issue.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {!issuesPending && requestsSuccess ? (
              <Pagination
                totalItems={
                  ctx.spy(model.repository.dataAtom)?.open_issues_count
                }
                onChange={onPaginationChange}
                pageSize={ctx.spy(model.issuesPerPage)}
                page={ctx.spy(model.issuesPage)}
              />
            ) : null}
          </>
        </div>
      </Stack>
    </>
  )
})

const issueStateColor = (issue: model.Issue) => {
  if (issue.state === 'open') return 'green'
  if (issue.state_reason === 'completed') return 'magenta'
  if (issue.state_reason === 'not_planned') return 'red'
  return 'gray'
}
