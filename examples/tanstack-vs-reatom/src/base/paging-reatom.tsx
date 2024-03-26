import { atom, reatomResource, withDataAtom } from '@reatom/framework'
import { reatomComponent } from '@reatom/npm-react'
import {
  Container,
  Flex,
  Pagination as MPagination,
  Table,
  Loader,
} from '@mantine/core'

import { getIssues } from '../api'

const pageAtom = atom(1, 'pageAtom')

const initState = { data: [], total: 1 }
const issuesReaction = reatomResource((ctx) => {
  const page = ctx.spy(pageAtom)
  return ctx.schedule(() =>
    getIssues(
      { owner: 'artalar', repo: 'reatom', page },
      { signal: ctx.controller.signal },
    ),
  )
}, 'issuesReaction').pipe(withDataAtom(initState))

export const PagingReatom = reatomComponent(({ ctx }) => {
  return (
    <Container>
      <Flex gap="md" mt="lg" direction="column">
        <Flex justify="space-between">
          <MPagination
            value={ctx.spy(pageAtom)}
            onChange={ctx.bind(pageAtom)}
            total={ctx.spy(issuesReaction.dataAtom).total}
          />
          {!!ctx.spy(issuesReaction.pendingAtom) && <Loader size="sm" />}
        </Flex>
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
  )
}, 'PagingReatom')
