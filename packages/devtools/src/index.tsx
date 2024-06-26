import { atom, type AtomProto, type Ctx, type Rec } from '@reatom/core'
import { h, mount } from '@reatom/jsx'
// @ts-expect-error TODO write types
import { Inspector } from '@observablehq/inspector'
// @ts-expect-error
import observablehqStyles from '../../../node_modules/@observablehq/inspector/dist/inspector.css'

export const connectDevtools = async (
  ctx: Ctx,
  {
    separator = /\.|#/,
    privatePrefix = '_',
  }: { separator?: string | RegExp | ((name: string) => Array<string>); privatePrefix?: string } = {},
) => {
  const MAX_Z = Math.pow(2, 32) - 1

  const width = atom('0px', 'inspect._width')
  const height = atom('0px', 'inspect._height')
  let folded: null | { width: string; height: string } = null
  let moved = false

  const logo = (
    <svg:svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      fill="#151134"
      stroke="#fff"
      stroke-width="15px"
      aria-label="Reatom devtools DnD handler"
      tabindex="0"
      css={`
        --size: 5rem;
        position: absolute;
        width: var(--size);
        height: var(--size);
        top: calc(var(--size) * -0.6);
        left: calc(var(--size) * -0.6);
        outline: none;
        z-index: ${MAX_Z};
      `}
      on:pointerdown={(ctx, e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      on:pointermove={(ctx, e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          moved = true
          folded = null
          width(ctx, `${Math.min(window.innerWidth * 0.9, window.innerWidth - e.clientX)}px`)
          height(ctx, `${Math.min(window.innerHeight * 0.9, window.innerHeight - e.clientY)}px`)
        }
      }}
      on:lostpointercapture={() => {
        moved = false
      }}
      on:pointerup={(ctx, e) => {
        if (moved) return

        if (folded) {
          width(ctx, folded.width)
          height(ctx, folded.height)
          folded = null
        } else {
          const { width: w, height: h } = containerEl.getBoundingClientRect()
          if (w + h < 100) {
            width(ctx, `${window.innerWidth * 0.7}px`)
            height(ctx, `${window.innerHeight * 0.7}px`)
          } else {
            folded = { width: `${w}px`, height: `${h}px` }
            width(ctx, '0px')
            height(ctx, '0px')
          }
        }
      }}
    >
      <svg:circle cx="200" cy="200" r="200" fill="#fff" stroke-width="0" />
      <svg:circle cx="200" cy="200" r="175" stroke-width="0" />
      <svg:circle cx="180" cy="180" r="130" />
      <svg:circle cx="215" cy="180" r="70" />
      <svg:circle cx="150" cy="94" r="38" />
      <svg:circle cx="100" cy="195" r="40" />
      <svg:circle cx="165" cy="275" r="30" />
      <svg:circle cx="250" cy="265" r="20" />
      <svg:circle cx="57" cy="270" r="20" />
      <svg:circle cx="215" cy="345" r="36" />
      <svg:circle cx="310" cy="290" r="36" />
      <svg:circle cx="345" cy="195" r="30" />
      <svg:circle cx="321" cy="107" r="25" />
      <svg:circle cx="260" cy="50" r="20" />
      <svg:circle cx="120" cy="330" r="25" />
    </svg:svg>
  )

  const inspectorEl = (
    <div
      css={`
        width: 100%;
        height: 100%;
        overflow: auto;
        z-index: 1;
      `}
    />
  )
  const inspector = new Inspector(inspectorEl) as { fulfilled(data: any): void }

  const reloadEl = (
    <button
      css={`
        position: absolute;
        top: 1px;
        left: 40px;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 0 0 6px 6px;
        font-size: 0.8em;
        z-index: 10;
        background: transparent;
        color: #7f7f7f;
        cursor: pointer;
        font-size: 1em;
      `}
      title="Reload"
      aria-label="Reload"
      on:click={async () => {
        inspector.fulfilled(logObject)
      }}
    >
      ↻
    </button>
  )

  const logEl = (
    <button
      css={`
        position: absolute;
        top: 1px;
        left: 70px;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 0 0 6px 6px;
        font-size: 0.8em;
        z-index: 10;
        background: transparent;
        color: #7f7f7f;
        cursor: pointer;
        font-size: 1em;
      `}
      title="Log structured clone"
      aria-label="Log structured clone"
      on:click={() => {
        try {
          console.log(structuredClone(logObject))
        } catch {
          console.warn(
            "Reatom: can't make a structured clone to log a snapshot, log live state instead, the values could be changed during a time.",
          )
          console.log(logObject)
        }
      }}
    >
      log
    </button>
  )

  const observableContainer = (
    <div
      css={`
        width: 100%;
        height: 100%;
        overflow: auto;
      `}
    />
  )

  const containerEl = (
    <div
      css={`
        position: fixed;
        bottom: calc(5rem / -2);
        right: 0;
        padding-top: 2em;
        width: var(--width);
        height: var(--height);
        z-index: ${MAX_Z};
        background: hsl(244deg 20% 90%);
      `}
      css:width={width}
      css:height={height}
    >
      {logo}
      {reloadEl}
      {logEl}
      {observableContainer}
    </div>
  )

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
    inspectorEl,
  )

  const logObject: Rec = {}
  const touched = new WeakSet<AtomProto>()

  ctx.subscribe(async (logs) => {
    // await null // needed to prevent `Maximum call stack size exceeded` coz `parseAtoms`

    for (const { proto, state } of logs) {
      let name = proto.name!
      const path = typeof separator === 'function' ? separator(name) : name.split(separator)

      if (proto.isAction || touched.has(proto) || path.some((key) => key.startsWith(privatePrefix))) {
        continue
      }

      let thisLogObject = logObject

      path.forEach((key, i, { length }) => {
        if (i === length - 1) {
          name = key
        } else {
          thisLogObject = thisLogObject[`[${key}]`] ??= {}
        }
      })

      let update = (state: any) => {
        thisLogObject[name] = state // parseAtoms(ctx, state)
      }

      if (name === 'urlAtom') {
        update = (state) => {
          thisLogObject[name] = state.href
        }
      }

      update(state)
      ;(proto.updateHooks ??= new Set()).add((ctx, { state }) => {
        update(state)
      })

      touched.add(proto)
    }
  })

  const clearId = setInterval(() => {
    if (Object.keys(logObject).length > 0) {
      inspector.fulfilled(logObject)
      clearTimeout(clearId)
    }
  }, 100)

  mount(document.body, containerEl)
}
