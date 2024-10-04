import { Atom, isAction, isAtom, type Rec } from '@reatom/core'
import { FC, h, mount } from '@reatom/jsx'
// @ts-expect-error TODO write types
import { Inspector } from '@observablehq/inspector'
// @ts-expect-error
import observablehqStyles from '../../../node_modules/@observablehq/inspector/dist/inspector.css'

export const ObservableHQ: FC<{ snapshot: any }> = ({ snapshot }) => {
  return (
    <div
      css={`
        width: 100%;
        overflow: auto;
      `}
      ref={(ctx, observableContainer) => {
        const shadowRoot = observableContainer.attachShadow({ mode: 'open' })
        shadowRoot.append(
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

              if (isAtom(snapshot)) {
                return ctx.subscribe(snapshot, (payload) => inspector.fulfilled(payload))
              } else {
                inspector.fulfilled(snapshot)
              }
            }}
          />,
        )
      }}
    />
  )
}
