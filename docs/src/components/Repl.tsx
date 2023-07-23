import { EditorView, basicSetup } from 'codemirror'
import { EditorState, StateField } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { initialize, transform } from 'esbuild-wasm'
import { useState } from 'preact/hooks'
// @ts-expect-error TODO write types
import { Inspector } from '@observablehq/inspector'

// needed only for IDE syntax highlight
const styled = (s: TemplateStringsArray) => s.join('')

const IMPORT_PREFIX = 'https://esm.sh/'

const DEFAULT_EXAMPLE = `
import { atom, createCtx } from '@reatom/core'

const ctx = createCtx()

const numberAtom = atom(0, 'numberAtom')
const dubleAtom = atom((ctx) => {
  console.log(ctx.cause)
  return ctx.spy(numberAtom) * 2
}, 'dubleAtom')

ctx.subscribe(dubleAtom, console.log)
numberAtom(ctx, (s) => s + 1)
`.trim()

const { log } = console
console.log = (...logs) => {
  log(...logs)

  if (!LOGS) return

  const timeEl = document.createElement('time')
  timeEl.textContent = new Date().toISOString()
  LOGS.appendChild(timeEl)

  for (const log of logs) {
    const logEl = document.createElement('div')
    new Inspector(logEl).fulfilled(log)
    LOGS.appendChild(logEl)
  }

  LOGS.scrollTop = LOGS.scrollHeight
}

let LOGS: null | HTMLDivElement = null

let i = 0
let esbuildInitializer: Promise<void>

export const Repl = () => {
  const [editor, setEditor] = useState<EditorView | null>(null)

  const setupEditor = (parent: null | HTMLElement) => {
    if (!parent) return

    setEditor((state) => {
      if (state) return state

      const handleChange = async (code: string) => {
        await new Promise((r) => setTimeout(r, 100))
        if (code !== editor!.state.doc.toString()) return

        location.hash = '#' + encodeURIComponent(code)
      }

      const listenChangesExtension = StateField.define({
        // we won't use the actual StateField value, null or undefined is fine
        create: () => null,
        update: (value, transaction) => {
          if (transaction.docChanged) {
            handleChange(transaction.newDoc.toString())
          }
          return null
        },
      })
      const doc =
        decodeURIComponent(location.hash.substring(1)) || DEFAULT_EXAMPLE
      const editor = new EditorView({
        parent,
        state: EditorState.create({
          doc,
          extensions: [
            basicSetup,
            javascript({ typescript: true }),
            listenChangesExtension,
          ],
        }),
      })

      return editor
    })
  }

  const play = async (e: Event) => {
    const button = e.currentTarget as HTMLButtonElement
    button.disabled = true
    button.innerText = '⌛'

    try {
      const lastLogRecord = LOGS?.children[LOGS?.children.length - 1]
      if (lastLogRecord instanceof HTMLHRElement == false) {
        const br = document.createElement('hr')
        LOGS?.appendChild(br)
      }

      await (esbuildInitializer ??= initialize({
        // wasmURL: '/node_modules/esbuild-wasm/esbuild.wasm',
        wasmURL: new URL(
          '/node_modules/esbuild-wasm/esbuild.wasm',
          import.meta.url,
        ),
      }))

      let { code } = await transform(
        `${editor!.state.doc}\n;/* reload trigger */${i++}`,
        {
          loader: 'ts',
          sourcemap: false,
          minify: false,
        },
      )

      let shift = 0
      // TODO match line brake in import statement!
      for (const regexp of [/import.*('|")(?<path>.*)('|")/g]) {
        for (const match of code.matchAll(regexp)) {
          const { path } = match.groups ?? {}

          if (!path || path.startsWith(IMPORT_PREFIX)) continue

          const index = code.indexOf(path, match.index! + shift)
          shift += IMPORT_PREFIX.length

          code =
            code.substring(0, index) +
            `${IMPORT_PREFIX}${path}` +
            code.substring(index + path.length)
        }
      }

      await import(
        'data:text/javascript;charset=utf-8,' + encodeURIComponent(code)
      )
    } finally {
      button.disabled = false
      button.innerText = '▶︎'
    }
  }

  return (
    <section>
      <button onClick={play} class="btn play">
        ▶︎
      </button>
      <div ref={setupEditor} class="editor"></div>
      <div ref={(ref) => (LOGS = ref)} class="logs" />
      <style>{styled`
        main h1 {
          font-size: 1rem !important;
          margin: 0 !important;
        }

        section {
          position: relative;
        }

        .cm-editor {
          min-height: 5rem;
          max-height: 30rem;
          z-index: -1;
        }

        .editor .cm-gutters {
          background-color: transparent;
        }

        .editor .cm-gutters .cm-activeLineGutter {
          background-color: rgba(0, 0, 0, 0.2);
        }

        .btn {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 3rem;
          height: 3rem;
          font-size: 1.5rem;
          border: none;
          opacity: 0.5;
          filter: grayscale(1);
        }

        .play {
          top: 0.5rem;
          right: 0.5rem;
        }

        .logs {
          position: relative;
          margin: 1rem 0;
          max-height: 50vh;
          overflow-y: auto;
        }

        .logs time {
          font-size: 0.75em;
        }

        .observablehq {
          margin-left: 0.5rem;
        }
          
        .observablehq svg {
          display: inline-block;
        }
      `}</style>
      <style>{styled`
        /* copied from "@observablehq/inspector/src/style.css" */

        :root {
          --syntax_normal: #1b1e23;
          --syntax_comment: #a9b0bc;
          --syntax_number: #20a5ba;
          --syntax_keyword: #c30771;
          --syntax_atom: #10a778;
          --syntax_string: #008ec4;
          --syntax_error: #ffbedc;
          --syntax_unknown_variable: #838383;
          --syntax_known_variable: #005f87;
          --syntax_matchbracket: #20bbfc;
          --syntax_key: #6636b4;
          --mono_fonts: 82%/1.5 Menlo, Consolas, monospace;
        }
        
        .observablehq--expanded,
        .observablehq--collapsed,
        .observablehq--function,
        .observablehq--import,
        .observablehq--string:before,
        .observablehq--string:after,
        .observablehq--gray {
          color: var(--syntax_normal);
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
          color: var(--syntax_comment);
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
          color: var(--syntax_atom);
        }
        
        .observablehq--number,
        .observablehq--bigint,
        .observablehq--date,
        .observablehq--regexp,
        .observablehq--symbol,
        .observablehq--green {
          color: var(--syntax_number);
        }
        
        .observablehq--index,
        .observablehq--key {
          color: var(--syntax_key);
        }
        
        .observablehq--prototype-key {
          color: #aaa;
        }
        
        .observablehq--empty {
          font-style: oblique;
        }
        
        .observablehq--string,
        .observablehq--purple {
          color: var(--syntax_string);
        }
        
        .observablehq--error,
        .observablehq--red {
          color: #e7040f;
        }
        
        .observablehq--inspect {
          font: var(--mono_fonts);
          overflow-x: auto;
          display: block;
          white-space: pre;
        }
        
        .observablehq--error .observablehq--inspect {
          word-break: break-all;
          white-space: pre-wrap;
        }
      `}</style>
    </section>
  )
}
