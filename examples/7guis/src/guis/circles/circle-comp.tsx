import React from 'react'
import { reatomComponent } from '@reatom/npm-react'
import type { Circle } from '~/guis/circles/model'
import { Box } from '~/basic'
import { cx } from '~/utils'

interface CircleCompProps {
  circle: Circle
}

export const CircleComp = React.memo<CircleCompProps>(
  reatomComponent(({ ctx, circle }) => {
    return (
      <Box
        className={cx(
          'absolute',
          'border-[1px]',
          'border-solid',
          'border-[#333]',
          'rounded-[100px]',
          '-translate-x-1/2',
          '-translate-y-1/2',
          ctx.spy(circle.activeAtom) ? 'bg-[#eee]' : undefined,
        )}
        style={{
          top: ctx.spy(circle.yAtom),
          left: ctx.spy(circle.xAtom),
          width: ctx.spy(circle.diameterAtom),
          height: ctx.spy(circle.diameterAtom),
        }}
      />
    )
  }, 'CircleComp'),
)
