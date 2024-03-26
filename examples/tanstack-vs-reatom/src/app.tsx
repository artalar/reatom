import { Link, Route, Routes } from 'react-router-dom'
import { reatomEnum } from '@reatom/framework'
import { reatomComponent } from '@reatom/npm-react'
import { withSearchParamsPersist } from '@reatom/url'
import { useDisclosure } from '@mantine/hooks'
import { AppShell, Burger, Group, NavLink, Tabs, Title } from '@mantine/core'

import { PagingTanstack as PagingTanstackBase } from './base/paging-tanstack'
import { PagingTanstack as PagingTanstackAdvanced } from './advanced/paging-tanstack'
import { PagingReatom as PagingReatomBase } from './base/paging-reatom'
import { PagingReatom as PagingReatomAdvanced } from './advanced/paging-reatom'
import { RouterSync } from './RouterSync'

const frameworkTabAtom = reatomEnum(
  ['TanstackBase', 'TanstackAdvanced', 'ReatomBase', 'ReatomAdvanced'],
  'frameworkTabAtom',
).pipe(withSearchParamsPersist('framework'))
type Framework = keyof typeof frameworkTabAtom.enum

export const FrameworkSwitcher = reatomComponent(
  ({ ctx }) => (
    <Tabs
      value={ctx.spy(frameworkTabAtom)}
      onChange={(value) =>
        value
          ? frameworkTabAtom(ctx, value as Framework)
          : frameworkTabAtom.setTanstackBase(ctx)
      }
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value={frameworkTabAtom.enum.TanstackBase}>
          Tanstack base
        </Tabs.Tab>
        <Tabs.Tab value={frameworkTabAtom.enum.ReatomBase}>
          Reatom base
        </Tabs.Tab>
        <Tabs.Tab value={frameworkTabAtom.enum.TanstackAdvanced}>
          Tanstack advanced
        </Tabs.Tab>
        <Tabs.Tab value={frameworkTabAtom.enum.ReatomAdvanced}>
          Reatom advanced
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value={frameworkTabAtom.enum.TanstackBase}>
        <PagingTanstackBase />
      </Tabs.Panel>
      <Tabs.Panel value={frameworkTabAtom.enum.ReatomBase}>
        <PagingReatomBase />
      </Tabs.Panel>
      <Tabs.Panel value={frameworkTabAtom.enum.TanstackAdvanced}>
        <PagingTanstackAdvanced />
      </Tabs.Panel>
      <Tabs.Panel value={frameworkTabAtom.enum.ReatomAdvanced}>
        <PagingReatomAdvanced />
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
            <Route path="/paging" element={<FrameworkSwitcher />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </>
  )
}
