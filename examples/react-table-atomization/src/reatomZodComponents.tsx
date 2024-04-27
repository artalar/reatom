import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import Switch from '@mui/material/Switch'
import { reatomComponent } from '@reatom/npm-react'
import { z } from 'zod'

import { EXTENSIONS } from '@reatom/npm-zod'
import { Rec } from '@reatom/framework'

declare module '@reatom/npm-zod' {
  interface ZodAtom<T> {
    TextField: T extends string | number ? typeof TextField : never
  }

  export interface BooleanAtom {
    Checkbox: typeof Checkbox
    Switch: typeof Switch
  }
}

EXTENSIONS.push((anAtom, type) => {
  if (type === z.ZodFirstPartyTypeKind.ZodString) {
    return Object.assign(anAtom, {
      TextField: reatomComponent<Rec>(
        ({ ctx, ...props }) => (
          <TextField
            value={ctx.spy(anAtom)}
            onChange={(event) => {
              anAtom(ctx, event.target.value)
              props.onChange?.(event)
            }}
            {...props}
          />
        ),
        'TextField',
      ),
    })
  }

  if (type === z.ZodFirstPartyTypeKind.ZodNumber) {
    return Object.assign(anAtom, {
      TextField: reatomComponent<Rec>(
        ({ ctx, ...props }) => (
          <TextField
            value={ctx.spy(anAtom)}
            onChange={(event) => {
              if (!isNaN(+event.target.value)) anAtom(ctx, +event.target.value)
              props.onChange?.(event)
            }}
            {...props}
          />
        ),
        'TextField',
      ),
    })
  }

  if (type === z.ZodFirstPartyTypeKind.ZodBoolean) {
    return Object.assign(anAtom, {
      Checkbox: reatomComponent<Rec>(
        ({ ctx, ...props }) => (
          <Checkbox
            checked={ctx.spy(anAtom)}
            onChange={(event) => {
              anAtom(ctx, event.target.checked)
              props.onChange?.(event)
            }}
            {...props}
          />
        ),
        'Checkbox',
      ),

      Switch: reatomComponent<Rec>(
        ({ ctx, ...props }) => (
          <Switch
            checked={ctx.spy(anAtom)}
            onChange={(event) => {
              anAtom(ctx, event.target.checked)
              props.onChange?.(event)
            }}
            {...props}
          />
        ),
        'Switch',
      ),
    })
  }

  return anAtom
})
