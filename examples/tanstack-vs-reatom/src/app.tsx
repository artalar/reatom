import React from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { atom } from '@reatom/framework'
import { reatomComponent } from '@reatom/npm-react'
import { withSearchParamsPersist } from '@reatom/url'
import { useDisclosure } from '@mantine/hooks'
import { AppShell, Burger, Group, NavLink, Tabs, Title } from '@mantine/core'

import { PagingTanstack } from './final_example/paging-tanstack'
import { PagingReatom } from './final_example/paging-reatom'
import { RouterSync } from './RouterSync'

const frameworkTabAtom = atom('Tanstack', 'frameworkTabAtom').pipe(
  withSearchParamsPersist('framework'),
)

export const FrameworkSwitcher = reatomComponent<{
  Tanstack: React.FC
  Reatom: React.FC
}>(
  ({ ctx, Tanstack, Reatom }) => (
    <Tabs
      value={ctx.spy(frameworkTabAtom)}
      onChange={(value) => value && frameworkTabAtom(ctx, value)}
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value="Tanstack">Tanstack</Tabs.Tab>
        <Tabs.Tab value="Reatom">Reatom</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="Tanstack">
        <Tanstack />
      </Tabs.Panel>

      <Tabs.Panel value="Reatom">
        <Reatom />
      </Tabs.Panel>
    </Tabs>
  ),
  'FrameworkSwitcher',
)

export const App = () => {
  const [opened, { toggle }] = useDisclosure()

  return (
    <>
      <RouterSync />
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 200,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Title>Reatom VS Tanstack</Title>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <NavLink
            label="Paging"
            component={Link}
            to="/paging"
            variant="subtle"
          />
        </AppShell.Navbar>
        <AppShell.Main>
          <Routes>
            <Route
              path="/paging"
              element={
                <FrameworkSwitcher
                  Tanstack={PagingTanstack}
                  Reatom={PagingReatom}
                />
              }
            />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </>
  )
}
