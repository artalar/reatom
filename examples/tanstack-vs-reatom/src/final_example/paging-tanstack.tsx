import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Container,
  Flex,
  Pagination as MPagination,
  Table,
  Loader,
} from '@mantine/core'

import { getIssues } from '../api'

const usePaging = () => {
  const [searchParams, setSearchParams] = useSearchParams({ page: '1' })
  const page = Number(searchParams.get('page') || '1')
  const setPage = React.useCallback(
    (newPage: number) => setSearchParams({ page: String(newPage) }),
    [],
  )
  return [page, setPage] as const
}

const ISSUES_KEY = 'issues'
const getInitState = (): Awaited<ReturnType<typeof getIssues>> => {
  const snapshot = localStorage.getItem(ISSUES_KEY)
  return snapshot ? JSON.parse(snapshot) : { data: [], total: 1 }
}
const useIssuesQuery = (page: number) => {
  return useQuery({
    queryKey: ['users', page],
    queryFn: (context) =>
      getIssues(
        { owner: 'artalar', repo: 'reatom', page },
        { signal: context.signal },
      ),
    placeholderData: (prev = getInitState()) => prev,
    refetchOnMount: false,
  })
}

const Pagination = ({
  page,
  setPage,
  total,
  isFetching,
}: {
  page: number
  setPage: (page: number) => void
  total: number
  isFetching: boolean
}) => (
  <Flex justify="space-between">
    <MPagination value={page} onChange={setPage} total={total} />
    {isFetching && <Loader size="sm" />}
  </Flex>
)

export const PagingTanstack = () => {
  const [page, setPage] = usePaging()

  const { data, isFetching } = useIssuesQuery(page)

  React.useEffect(() => {
    if (data) {
      localStorage.setItem(ISSUES_KEY, JSON.stringify(data))
    }
  }, [data])

  const [total, setTotal] = React.useState(1)

  React.useEffect(() => {
    if (data?.total) {
      setTotal((state) => Math.max(state, data.total))
    }
  }, [data?.total ?? 1])

  return (
    <Container style={{ opacity: isFetching ? 0.5 : 1 }}>
      <Flex gap="md" mt="lg" direction="column">
        <Pagination
          page={page}
          setPage={setPage}
          total={total}
          isFetching={isFetching}
        />
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
