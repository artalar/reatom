import { reatomRoute } from '@reatom/core'

import { AnimationDemo } from './demos/AnimationDemo'
import { BooleanDemo } from './demos/BooleanDemo'
import { ColorDemo } from './demos/ColorDemo'
import { EssentialsDemo } from './demos/EssentialsDemo'
import { MixerDemo } from './demos/MixerDemo'
import { MonitorDemo } from './demos/MonitorDemo'
import { NumberDemo } from './demos/NumberDemo'
import { PointDemo } from './demos/PointDemo'
import { StringDemo } from './demos/StringDemo'
import { ThreeDemo } from './demos/ThreeDemo'
import { UIComponentsDemo } from './demos/UIComponentsDemo'

export const rootRoute = reatomRoute({
  render: ({ outlet }) => (
    <div>
      {outlet().length > 0 ? (
        outlet()
      ) : (
        <div>
          <h2>Tweakpane + Reatom</h2>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
            This example shows how Reatom extensions embed Tweakpane controls as
            reactive endpoints. Reatom owns the state; Tweakpane rents access.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <a
              href="/mixer"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#0ea5e9',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              View Audio Mixer
            </a>
          </p>
        </div>
      )}
    </div>
  ),
})

export const animationRoute = rootRoute.reatomRoute({
  path: 'animation',
  render: () => <AnimationDemo key="animation" />,
})

export const booleanRoute = rootRoute.reatomRoute({
  path: 'boolean',
  render: () => <BooleanDemo key="boolean" />,
})

export const colorRoute = rootRoute.reatomRoute({
  path: 'color',
  render: () => <ColorDemo key="color" />,
})

export const essentialsRoute = rootRoute.reatomRoute({
  path: 'essentials',
  render: () => <EssentialsDemo key="essentials" />,
})

export const mixerRoute = rootRoute.reatomRoute({
  path: 'mixer',
  render: () => <MixerDemo key="mixer" />,
})

export const monitorRoute = rootRoute.reatomRoute({
  path: 'monitor',
  render: () => <MonitorDemo key="monitor" />,
})

export const numberRoute = rootRoute.reatomRoute({
  path: 'number',
  render: () => <NumberDemo key="number" />,
})

export const pointRoute = rootRoute.reatomRoute({
  path: 'point',
  render: () => <PointDemo key="point" />,
})

export const stringRoute = rootRoute.reatomRoute({
  path: 'string',
  render: () => <StringDemo key="string" />,
})

export const uiComponentsRoute = rootRoute.reatomRoute({
  path: 'ui-components',
  render: () => <UIComponentsDemo key="ui-components" />,
})

export const threeRoute = rootRoute.reatomRoute({
  path: 'three',
  render: () => <ThreeDemo key="three" />,
})
