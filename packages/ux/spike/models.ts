import type { Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  isInit,
  named,
  reatomLinkedList,
  withActions,
  withComputed,
} from '@reatom/core'

// --- disclosure -------------------------------------------------------------

export interface DisclosureOptions {
  open?: boolean
  animated?: boolean | number
  name?: string
}

export interface DisclosureModel extends Atom<boolean> {
  animated: Atom<boolean | number>
  animating: Atom<boolean>
  mounted: Computed<boolean>
  show: Action<[], true>
  hide: Action<[], false>
  toggle: Action<[], boolean>
}

export const reatomDisclosure = (
  options: DisclosureOptions = {},
): DisclosureModel => {
  const {
    open: initOpen = false,
    animated: initAnimated = false,
    name = named('disclosure'),
  } = options

  const animated = atom<boolean | number>(initAnimated, `${name}.animated`)

  const open = atom(initOpen, name)

  const animating = atom(
    !!initAnimated && initOpen,
    `${name}.animating`,
  ).extend(
    withComputed((state) => {
      open()
      if (!animated()) return false
      return isInit() ? state : true
    }),
  )

  const mounted = computed(() => open() || animating(), `${name}.mounted`)

  return open
    .extend(() => ({ animated, animating, mounted }))
    .extend(
      withActions((target) => ({
        show: () => target.set(true) as true,
        hide: () => target.set(false) as false,
        toggle: () => target.set((state) => !state),
      })),
    )
}

// --- composite --------------------------------------------------------------

export interface CompositeItemInit {
  id: string
  disabled?: boolean
  rowId?: string
  children?: string
}

export interface CompositeItemModel {
  id: string
  rowId: string | undefined
  disabled: Atom<boolean>
  element: Atom<HTMLElement | null>
  active: Computed<boolean>
}

export const reatomComposite = (
  options: {
    activeId?: string | null
    focusLoop?: boolean
    name?: string
  } = {},
) => {
  const {
    activeId: initActiveId = null,
    focusLoop: initFocusLoop = false,
    name = named('composite'),
  } = options

  const activeId = atom<string | null>(initActiveId, `${name}.activeId`)
  const focusLoop = atom(initFocusLoop, `${name}.focusLoop`)

  const items = reatomLinkedList(
    {
      create: (init: CompositeItemInit): CompositeItemModel => ({
        id: init.id,
        rowId: init.rowId,
        disabled: atom(
          init.disabled ?? false,
          `${name}.items#${init.id}.disabled`,
        ),
        element: atom<HTMLElement | null>(
          null,
          `${name}.items#${init.id}.element`,
        ),
        active: computed(
          () => activeId() === init.id,
          `${name}.items#${init.id}.active`,
        ),
      }),
      key: 'id',
    },
    `${name}.items`,
  )

  const enabledIds = computed(
    () => items.array().flatMap((item) => (item.disabled() ? [] : [item.id])),
    `${name}.enabledIds`,
  )

  const step = (offset: 1 | -1) => {
    const ids = enabledIds()
    if (!ids.length) return null
    const index = ids.indexOf(activeId() ?? '')
    if (index === -1)
      return (offset === 1 ? ids[0] : ids[ids.length - 1]) ?? null
    const next = index + offset
    if (next < 0 || next >= ids.length) {
      return focusLoop()
        ? (ids.at(next % ids.length) ?? null)
        : (ids[index] ?? null)
    }
    return ids[next] ?? null
  }

  const move = action((id: string | null) => {
    activeId.set(id)
  }, `${name}.move`)

  return {
    activeId,
    focusLoop,
    items,
    enabledIds,
    next: () => step(1),
    previous: () => step(-1),
    first: () => enabledIds()[0] ?? null,
    last: () => enabledIds().at(-1) ?? null,
    /**
     * Replaces Ariakit's `moves` counter. The action itself is the event:
     * observe it with `getCalls(move)` inside an `effect`, `withCallHook`, or
     * `await wrap(take(move))` instead of diffing a counter.
     */
    move,
  }
}

// --- checkbox ---------------------------------------------------------------

export type CheckboxValue =
  | boolean
  | 'mixed'
  | string
  | number
  | ReadonlyArray<string | number>

export const nextCheckboxValue = (
  state: CheckboxValue,
  itemValue: string | number | undefined,
  checked: boolean,
): CheckboxValue => {
  if (itemValue == null) return checked
  if (!Array.isArray(state)) return state === itemValue ? false : itemValue
  if (checked) {
    return state.includes(itemValue) ? state : [...state, itemValue]
  }
  return state.filter((entry) => entry !== itemValue)
}

export const isCheckboxItemChecked = (
  state: CheckboxValue,
  itemValue: string | number | undefined,
): boolean | 'mixed' => {
  if (itemValue != null) {
    return Array.isArray(state)
      ? state.includes(itemValue)
      : state === itemValue
  }
  if (Array.isArray(state)) return false
  if (state === 'mixed') return 'mixed'
  return typeof state === 'boolean' ? state : false
}

export const reatomCheckbox = (
  options: {
    value?: CheckboxValue
    disabled?: boolean
    readOnly?: boolean
    name?: string
  } = {},
) => {
  const {
    value: initValue = false,
    disabled: initDisabled = false,
    readOnly: initReadOnly = false,
    name = named('checkbox'),
  } = options

  const value = atom<CheckboxValue>(initValue, name)
  const disabled = atom(initDisabled, `${name}.disabled`)
  const readOnly = atom(initReadOnly, `${name}.readOnly`)
  const editable = computed(
    () => !disabled() && !readOnly(),
    `${name}.editable`,
  )

  const item = (itemValue?: string | number) => {
    const itemName = `${name}#${itemValue ?? 'self'}`
    const checked = computed(
      () => isCheckboxItemChecked(value(), itemValue),
      `${itemName}.checked`,
    )
    return {
      checked,
      toggle: action(() => {
        if (!editable()) return
        const state = value()
        if (
          itemValue == null &&
          (state === 'mixed' || typeof state === 'boolean')
        ) {
          value.set(state === 'mixed' ? true : !state)
          return
        }
        value.set(nextCheckboxValue(state, itemValue, checked() !== true))
      }, `${itemName}.toggle`),
    }
  }

  return value.extend(() => ({ disabled, readOnly, editable, item }))
}
