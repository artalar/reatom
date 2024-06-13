// @jsxRuntime classic
// @jsx h
import { type AtomProto, type Ctx, type Rec } from '@reatom/core'
// import { parseAtoms } from '@reatom/lens'
import { h, mount } from '@reatom/jsx'

export const experimental_reatomInspector = async (
  ctx: Ctx,
  {
    separator = /\.|#/,
    privatePrefix = '_',
  }: { separator?: string | RegExp; privatePrefix?: string } = {},
) => {
  // discovery fix
  globalThis.global = globalThis
  const { createDiscovery } = await import('./discovery')

  const MAX_Z = Math.pow(2, 32) - 1

  // TODO: babel problem
  // const logo = (
  //   <svg:svg
  //     viewBox="0 0 400 400"
  //     xmlns="http://www.w3.org/2000/svg"
  //     fill="#151134"
  //     stroke="#fff"
  //     stroke-width="15px"
  //     aria-label="Reatom devtools DnD handler"
  //     tabindex="0"
  //     css={`
  //       --size: calc(5vmin + 5vmax);
  //       position: absolute;
  //       width: var(--size);
  //       height: var(--size);
  //       top: calc(var(--size) * -0.6);
  //       left: calc(var(--size) * -0.6);
  //       outline: none;
  //       z-index: ${MAX_Z};
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
      'aria-label': 'Reatom devtools DnD handler',
      tabindex: 0,
      css: `
      --size: calc(5vmin + 5vmax);
      position: absolute;
      width: var(--size);
      height: var(--size);
      top: calc(var(--size) * -0.6);
      left: calc(var(--size) * -0.6);
      outline: none;
      z-index: ${MAX_Z};
    `,
      'on:pointerdown': (ctx: Ctx, e: any) => {
        e.currentTarget?.setPointerCapture(e.pointerId)
      },
      'on:pointermove': (ctx: Ctx, e: any) => {
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
      `}
    />
  )

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
      `}
      title="Reload"
      aria-label="Reload"
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
      `}
      title="Log structured clone"
      aria-label="Log structured clone"
    >
      log
    </button>
  )

  const containerEl = (
    <div
      css={`
        position: absolute;
        bottom: 0;
        right: 0;
        width: 0px;
        height: 0px;
        z-index: ${MAX_Z};
      `}
    >
      {logo}
      {reloadEl}
      {logEl}
      <style>{`
        .discovery { padding: 0; border: 1px solid #141132ee; height: 100%; }
      `}</style>
      {inspectorEl}
    </div>
  )

  let widget = await createDiscovery(inspectorEl as HTMLElement)
  const logObject: Rec = {}
  const touched = new WeakSet<AtomProto>()

  ctx.subscribe(async (logs) => {
    // await null // needed to prevent `Maximum call stack size exceeded` coz `parseAtoms`

    for (const { proto, state } of logs) {
      if (
        proto.isAction ||
        proto.name?.includes(privatePrefix) ||
        touched.has(proto)
      ) {
        continue
      }

      let thisLogObject = logObject
      let name = proto.name!

      if (name[0] === name[0]?.toUpperCase()) {
        thisLogObject = logObject.Component ??= {}
      }

      name.split(separator).forEach((key, i, { length }) => {
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
      ;(proto.updateHooks ?? new Set()).add((ctx, { state }) => {
        console.log('update', name, state)
        update(state)
      })

      touched.add(proto)
    }

    console.log(logObject)
  })

  reloadEl.onclick = async () => {
    // @ts-expect-error
    widget.unloadData()
    inspectorEl.innerHTML = ''
    let widget = await createDiscovery(inspectorEl as HTMLElement)
    widget.setData(logObject)
  }

  logEl.onclick = () => {
    console.log(structuredClone(logObject))
  }

  const clearId = setInterval(() => {
    if (Object.keys(logObject).length > 0) {
      widget.setData(logObject)
      clearTimeout(clearId)
    }
  }, 100)

  mount(document.body, containerEl)
}
