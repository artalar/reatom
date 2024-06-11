// @jsxRuntime classic
// @jsx h
// TODO @artalar
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// @ts-expect-error TODO write types
import { Inspector } from '@observablehq/inspector'
import { type AtomProto, type Ctx, type Rec } from '@reatom/core'
import { parseAtoms } from '@reatom/lens'
// eslint-disable-next-line unused-imports/no-unused-imports
import { h, mount } from '@reatom/jsx'

export const experimental_reatomInspector = (ctx: Ctx) => {
  /* eslint-disable react/no-unknown-property */

  // For syntax highlighting and prettier support
  const css = (styles: TemplateStringsArray) => styles.join('')

  const MAX_Z = Math.pow(2, 32) - 1

  const styleEl = (
    <style>{css`
      .observablehq {
        margin-left: 2rem;
      }

      .observablehq--inspect {
        padding: 0.5rem 0;
      }

      .observablehq svg {
        display: inline-block;
      }

      .observablehq--expanded,
      .observablehq--collapsed,
      .observablehq--function,
      .observablehq--import,
      .observablehq--string:before,
      .observablehq--string:after,
      .observablehq--gray {
        /* color: var(--syntax_normal); */
      }

      .observablehq--collapsed,
      .observablehq--inspect a {
        cursor: pointer;
      }

      .observablehq--field {
        text-indent: -1em;
        margin-left: 1em;
      }

      .observablehq--empty {
        /* color: var(--syntax_comment); */
      }

      .observablehq--keyword,
      .observablehq--blue {
        color: #3182bd;
      }

      .observablehq--forbidden,
      .observablehq--pink {
        color: #e377c2;
      }

      .observablehq--orange {
        color: #e6550d;
      }

      .observablehq--null,
      .observablehq--undefined,
      .observablehq--boolean {
        /* color: var(--syntax_atom); */
      }

      .observablehq--number,
      .observablehq--bigint,
      .observablehq--date,
      .observablehq--regexp,
      .observablehq--symbol,
      .observablehq--green {
        /* color: var(--syntax_number); */
      }

      .observablehq--index,
      .observablehq--key {
        /* color: var(--syntax_key); */
      }

      .observablehq--prototype-key {
        color: #aaa;
      }

      .observablehq--empty {
        font-style: oblique;
      }

      .observablehq--string,
      .observablehq--purple {
        /* color: var(--syntax_string); */
      }

      .observablehq--error,
      .observablehq--red {
        color: #e7040f;
      }

      .observablehq--inspect {
        /* font: var(--mono_fonts); */
        overflow-x: auto;
        display: block;
        white-space: pre;
      }

      .observablehq--error .observablehq--inspect {
        word-break: break-all;
        white-space: pre-wrap;
      }
    `}</style>
  )

  // TODO: babel problem
  // const logo = (
  //   <svg:svg
  //     viewBox="0 0 400 400"
  //     xmlns="http://www.w3.org/2000/svg"
  //     fill="#151134"
  //     stroke="#fff"
  //     stroke-width="15px"
  //     css={`
  //       --size: calc(5vmin + 5vmax);
  //       position: absolute;
  //       width: var(--size);
  //       height: var(--size);
  //       top: calc(var(--size) * -0.6);
  //       left: calc(var(--size) * -0.6);
  //     `}
  //     on:pointerdown={(ctx, e) => {
  //       e.currentTarget.setPointerCapture(e.pointerId)
  //     }}
  //     on:pointermove={(ctx, e) => {
  //       if (e.currentTarget.hasPointerCapture(e.pointerId)) {
  //         const x = Math.min(
  //           window.innerWidth * 0.9,
  //           window.innerWidth - e.clientX,
  //         )
  //         const y = Math.min(
  //           window.innerHeight * 0.9,
  //           window.innerHeight - e.clientY,
  //         )
  //         containerEl.style.width = `${x}px`
  //         containerEl.style.height = `${y}px`
  //       }
  //     }}
  //   >
  //     <svg:circle cx="200" cy="200" r="200" fill="#fff" stroke-width="0" />
  //     <svg:circle cx="200" cy="200" r="175" stroke-width="0" />
  //     <svg:circle cx="180" cy="180" r="130" />
  //     <svg:circle cx="215" cy="180" r="70" />
  //     <svg:circle cx="150" cy="94" r="38" />
  //     <svg:circle cx="100" cy="195" r="40" />
  //     <svg:circle cx="165" cy="275" r="30" />
  //     <svg:circle cx="250" cy="265" r="20" />
  //     <svg:circle cx="57" cy="270" r="20" />
  //     <svg:circle cx="215" cy="345" r="36" />
  //     <svg:circle cx="310" cy="290" r="36" />
  //     <svg:circle cx="345" cy="195" r="30" />
  //     <svg:circle cx="321" cy="107" r="25" />
  //     <svg:circle cx="260" cy="50" r="20" />
  //     <svg:circle cx="120" cy="330" r="25" />
  //   </svg:svg>
  // )
  const logo = h(
    'svg:svg',
    {
      viewBox: '0 0 400 400',
      xmlns: 'http://www.w3.org/2000/svg',
      fill: '#151134',
      stroke: '#fff',
      'stroke-width': '15px',
      css: `
      --size: calc(5vmin + 5vmax);
      position: absolute;
      width: var(--size);
      height: var(--size);
      top: calc(var(--size) * -0.6);
      left: calc(var(--size) * -0.6);
    `,
      'on:pointerdown': (ctx, e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      'on:pointermove': (ctx, e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          const x = Math.min(
            window.innerWidth * 0.9,
            window.innerWidth - e.clientX,
          )
          const y = Math.min(
            window.innerHeight * 0.9,
            window.innerHeight - e.clientY,
          )
          containerEl.style.width = `${x}px`
          containerEl.style.height = `${y}px`
        }
      },
    },
    [
      h('svg:circle', {
        cx: '200',
        cy: '200',
        r: '200',
        fill: '#fff',
        'stroke-width': '0',
      }),
      h('svg:circle', {
        cx: '200',
        cy: '200',
        r: '175',
        'stroke-width': '0',
      }),
      h('svg:circle', {
        cx: '180',
        cy: '180',
        r: '130',
      }),
      h('svg:circle', {
        cx: '215',
        cy: '180',
        r: '70',
      }),
      h('svg:circle', {
        cx: '150',
        cy: '94',
        r: '38',
      }),
      h('svg:circle', {
        cx: '100',
        cy: '195',
        r: '40',
      }),
      h('svg:circle', {
        cx: '165',
        cy: '275',
        r: '30',
      }),
      h('svg:circle', {
        cx: '250',
        cy: '265',
        r: '20',
      }),
      h('svg:circle', {
        cx: '57',
        cy: '270',
        r: '20',
      }),
      h('svg:circle', {
        cx: '215',
        cy: '345',
        r: '36',
      }),
      h('svg:circle', {
        cx: '310',
        cy: '290',
        r: '36',
      }),
      h('svg:circle', {
        cx: '345',
        cy: '195',
        r: '30',
      }),
      h('svg:circle', {
        cx: '321',
        cy: '107',
        r: '25',
      }),
      h('svg:circle', {
        cx: '260',
        cy: '50',
        r: '20',
      }),
      h('svg:circle', {
        cx: '120',
        cy: '330',
        r: '25',
      }),
    ],
  )

  const inspectorEl = (
    <div
      css={`
        width: 100%;
        height: 100%;
        overflow: auto;
        z-index: 1;
        margin: calc(1vmin + 1vmax);
      `}
    />
  )

  const containerEl = (
    <div
      css={`
        position: absolute;
        bottom: 0;
        right: 0;
        width: 0px;
        height: 0px;
        background: #141132ee;
        z-index: ${MAX_Z};
      `}
    >
      {logo}
      {styleEl}
      {inspectorEl}
    </div>
  )

  const inspector = new Inspector(inspectorEl)
  const logObject: Rec = {}
  const touched = new WeakSet<AtomProto>()

  ctx.subscribe(async (logs) => {
    await null // needed to prevent `Maximum call stack size exceeded` coz `parseAtoms`

    for (const { proto, state } of logs) {
      if (proto.isAction || proto.name?.includes('_') || touched.has(proto)) {
        continue
      }

      let thisLogObject = logObject
      let { name } = proto

      if (name[0] === name[0].toUpperCase()) {
        thisLogObject = logObject.Component ??= {}
      }

      name.split(/\.|#/).forEach((key, i, { length }) => {
        if (i === length - 1) {
          name = key
        } else {
          thisLogObject = thisLogObject[`[${key}]`] ??= {}
        }
      })

      let update = (state: any) => {
        thisLogObject[name] = parseAtoms(ctx, state)
      }

      if (name === 'urlAtom') {
        update = (state) => {
          thisLogObject[name] = state.href
        }
      }

      update(state)
      ;(proto.updateHooks ?? new Set()).add((ctx, { state }) => {
        update(state)
      })

      touched.add(proto)
    }
  })

  inspector.fulfilled(logObject)

  mount(document.body, containerEl)
}
