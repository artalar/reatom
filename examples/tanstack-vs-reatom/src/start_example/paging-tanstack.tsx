import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Container,
  Flex,
  Pagination as MPagination,
  Table,
  Loader,
} from '@mantine/core'

import { getIssues } from '../api'

const initState = { data: [], total: 1 }
const useIssuesQuery = (page: number) => {
  return useQuery({
    queryKey: ['users', page],
    initialData: initState,
    queryFn: (context) =>
      getIssues(
        { owner: 'artalar', repo: 'reatom', page },
        { signal: context.signal },
      ),
  })
}

export const PagingTanstack = () => {
  const [page, setPage] = React.useState(1)

  const { data, isFetching } = useIssuesQuery(page)

  return (
    <Container>
      <Flex gap="md" mt="lg" direction="column">
        <Flex justify="space-between">
          <MPagination value={page} onChange={setPage} total={data.total} />
          {isFetching && <Loader size="sm" />}
        </Flex>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.data.map((issue) => (
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
}
