import { Atom, type Rec } from '@reatom/core'
import { h, mount } from '@reatom/jsx'
// @ts-expect-error TODO write types
import { Inspector } from '@observablehq/inspector'
// @ts-expect-error
import observablehqStyles from '../../../node_modules/@observablehq/inspector/dist/inspector.css'

export const ObservableHQ = ({ snapshot }: { snapshot: Atom<Rec> }) => {
  return (
    <div
      css={`
        width: 100%;
        height: 100%;
        overflow: auto;
      `}
      ref={(ctx, observableContainer) => {
        observableContainer.attachShadow({ mode: 'open' }).append(
          <style>
            {observablehqStyles.replaceAll(':root', '.observablehq')}
            {`
              .observablehq {
                margin: 1rem;
                margin-top: 0em;
              }

              .observablehq--inspect {
                padding: 0.5rem 0;
              }

              .observablehq svg {
                display: inline-block;
              }
            `}
          </style>,
          <div
            css={`
              width: 100%;
              height: 100%;
              overflow: auto;
              z-index: 1;
            `}
            ref={(ctx, inspectorEl) => {
              const inspector = new Inspector(inspectorEl) as { fulfilled(data: any): void }

              return snapshot.onChange((ctx, payload) => inspector.fulfilled(payload))
            }}
          />,
        )
      }}
    />
  )
}
