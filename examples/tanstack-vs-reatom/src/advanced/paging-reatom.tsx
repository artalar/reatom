import { reatomResource, withCache, withDataAtom } from '@reatom/framework'
import { reatomComponent } from '@reatom/npm-react'
import { searchParamsAtom } from '@reatom/url'
import { withLocalStorage } from '@reatom/persist-web-storage'
import {
  Container,
  Flex,
  Pagination as MPagination,
  Table,
  Loader,
} from '@mantine/core'

import { getIssues } from '../api'

const pageAtom = searchParamsAtom.lens('page', (page = '1') => Number(page))

const initState = { data: [], total: 1 }
const issuesReaction = reatomResource((ctx) => {
  const page = ctx.spy(pageAtom)
  return ctx.schedule(() =>
    getIssues(
      { owner: 'artalar', repo: 'reatom', page },
      { signal: ctx.controller.signal },
    ),
  )
}, 'issuesReaction').pipe(
  withDataAtom(initState, (_ctx, { data, total }, state) => ({
    data,
    total: Math.max(total, state.total),
  })),
  withCache({ withPersist: withLocalStorage }),
)

const Pagination = reatomComponent(
  ({ ctx }) => (
    <Flex justify="space-between">
      <MPagination
        value={ctx.spy(pageAtom)}
        onChange={ctx.bind(pageAtom)}
        total={ctx.spy(issuesReaction.dataAtom).total}
      />
      {!!ctx.spy(issuesReaction.pendingAtom) && <Loader size="sm" />}
    </Flex>
  ),
  'Pagination',
)

export const PagingReatom = reatomComponent(
  ({ ctx }) => (
    <Container
      style={{ opacity: ctx.spy(issuesReaction.pendingAtom) ? 0.5 : 1 }}
    >
      <Flex gap="md" mt="lg" direction="column">
        <Pagination />
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ctx.spy(issuesReaction.dataAtom).data.map((issue) => (
              <Table.Tr key={issue.id}>
                <Table.Td>{issue.title}</Table.Td>
                <Table.Td>{issue.state}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Flex>
    </Container>
  ),
  'PagingReatom',
)
