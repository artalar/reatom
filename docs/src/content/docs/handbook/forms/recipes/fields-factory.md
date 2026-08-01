---
title: Fields factory
description: Create reusable field factories with shared defaults, validation, and extensions
---

Fields can be very complex and may contain a lot of transformation, filtering, and data validation logic. For convenience when working with such fields, you can use the field factory pattern. A field factory allows you to create fields with predefined logic and validation, which simplifies working with forms and helps avoid code duplication.

Imagine we have a requirement to input time in different formats that the user can choose from. Moreover, this field is reused in different places. Using the `toState` and `fromState` field callbacks and their reactivity, we can achieve variable display and parsing of time depending on the format selected by the user.

```ts
import { atom, peek, reatomField } from '@reatom/core'
import { bindField, reatomComponent } from '@reatom/react'

const reatomDurationField = (initState: number, name: string) => {
  const formatAtom = atom<'hours' | 'minutes' | 'seconds'>(
    'minutes',
    `${name}.format`,
  )
  const displayStyleAtom = atom<'short' | 'long'>(
    'short',
    `${name}.displayStyle`,
  )

  return reatomField(initState, {
    name,
    fromState: (state: number) => {
      const format = formatAtom()
      const displayStyle = displayStyleAtom()

      const converted = {
        hours: state / 3600,
        minutes: state / 60,
        seconds: state,
      }[format]

      const suffix =
        displayStyle === 'short'
          ? { hours: 'h', minutes: 'm', seconds: 's' }[format]
          : { hours: ' hours', minutes: ' minutes', seconds: ' seconds' }[
              format
            ]

      return `${converted.toFixed(2)}${suffix}`
    },
    toState: (value: string, field) => {
      const format = formatAtom()
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''))
      if (isNaN(parsed)) return peek(field)

      return {
        hours: parsed * 3600,
        minutes: parsed * 60,
        seconds: parsed,
      }[format]
    },
  }).extend(() => ({
    format: formatAtom,
    displayStyle: displayStyleAtom,
  }))
}
```

Now let's use this factory to create a field instance and bind it to the UI:

```tsx
const field = reatomDurationField(0, 'duration')

const Field = reatomComponent(() => {
  return (
    <div>
      <fieldset>
        <input {...bindField(field)} placeholder="Enter duration" />
        <select
          value={field.format()}
          onChange={(e) =>
            field.format.set(e.target.value as 'hours' | 'minutes' | 'seconds')
          }
        >
          <option value="hours">Hours</option>
          <option value="minutes">Minutes</option>
          <option value="seconds">Seconds</option>
        </select>

        <label>
          Extended
          <input
            type="checkbox"
            checked={field.displayStyle() === 'long'}
            onChange={(e) =>
              field.displayStyle.set(e.target.checked ? 'long' : 'short')
            }
          />
        </label>
      </fieldset>

      <span>Parsed: {field()}</span>
    </div>
  )
})
```

This way, we allow input in seconds, minutes, and hours, ultimately converting them to seconds as the common field state. When the unit of measurement changes, the field value is recalculated to the selected unit. This field is ready to be used in different forms - you simply need to create another instance of this field:

```ts
const timerForm = reatomForm((name) => ({
  duration: reatomDurationField(0, `${name}.duration`),
}))

// all additional atoms are still accessible through the form
timerForm.fields.duration.format()
timerForm.fields.duration.displayStyle()
```
