import {
  atom,
  clearStack,
  context,
  rAF,
  reatomForm,
  take,
  top,
  wrap,
} from '@reatom/core'
import { type ComponentChildren, render } from 'preact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { bindField, reatomComponent, reatomContext } from './'

clearStack()

const tick = async () => {
  await wrap(take(rAF))
  await wrap(take(rAF))
}

const getRoot = () => document.getElementById('root')!

const mount = (node: ComponentChildren) => {
  const root = getRoot()
  render(
    <reatomContext.Provider value={top()}>{node}</reatomContext.Provider>,
    root,
  )
  return root
}

const getInput = () =>
  document.querySelector('[data-testid="name"]') as HTMLInputElement

const fireChange = (input: HTMLInputElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
})

afterEach(() => {
  getRoot().remove()
})

describe('bindField ref', () => {
  test('writes the bound element into field.elementRef', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'elemRefForm')
      const Form = reatomComponent(
        () => <input data-testid="name" {...bindField(form.fields.name)} />,
        'Form',
      )

      mount(<Form />)
      await wrap(tick())

      expect(form.fields.name.elementRef()).toBe(getInput())
    }))

  test('exposes focus() through field.elementRef', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'focusForm')
      const Form = reatomComponent(
        () => <input data-testid="name" {...bindField(form.fields.name)} />,
        'Form',
      )

      mount(<Form />)
      await wrap(tick())

      const input = getInput()
      expect(document.activeElement).not.toBe(input)

      form.fields.name.elementRef()?.focus()
      expect(document.activeElement).toBe(input)
    }))

  test('clears field.elementRef on unmount', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'unmountForm')
      const Form = reatomComponent(
        () => <input data-testid="name" {...bindField(form.fields.name)} />,
        'Form',
      )

      const root = mount(<Form />)
      await wrap(tick())
      expect(form.fields.name.elementRef()).toBeInstanceOf(HTMLInputElement)

      render(null, root)
      await wrap(tick())
      expect(form.fields.name.elementRef()).toBeUndefined()
    }))

  test('forwards the element to a user callback ref', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'fnRefForm')
      const userRef = vi.fn()
      const Form = reatomComponent(
        () => (
          <input
            data-testid="name"
            {...bindField(form.fields.name, { ref: userRef })}
          />
        ),
        'Form',
      )

      const root = mount(<Form />)
      await wrap(tick())

      const input = getInput()
      expect(userRef).toHaveBeenCalledWith(input)
      expect(form.fields.name.elementRef()).toBe(input)

      render(null, root)
      await wrap(tick())
      expect(userRef).toHaveBeenLastCalledWith(null)
    }))

  test('forwards the element to a user object ref', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'objRefForm')
      const userRef: { current: HTMLInputElement | null } = { current: null }
      const Form = reatomComponent(
        () => (
          <input
            data-testid="name"
            {...bindField(form.fields.name, { ref: userRef })}
          />
        ),
        'Form',
      )

      const root = mount(<Form />)
      await wrap(tick())
      expect(userRef.current).toBe(getInput())

      render(null, root)
      await wrap(tick())
      expect(userRef.current).toBe(null)
    }))

  test('keeps a stable ref identity across re-renders (no churn)', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'stableRefForm')
      const bump = atom(0, 'bump')
      const refSpy = vi.fn()
      const boundRefs: Array<(element: any) => void> = []

      const Form = reatomComponent(() => {
        bump() // subscribe to force re-renders
        // a brand new inline user ref identity on every render
        const bound = bindField(form.fields.name, {
          ref: (element) => refSpy(element),
        })
        boundRefs.push(bound.ref)
        return <input data-testid="name" {...bound} />
      }, 'Form')

      const root = mount(<Form />)
      await wrap(tick())

      const input = getInput()
      expect(refSpy).toHaveBeenCalledTimes(1)
      expect(refSpy).toHaveBeenLastCalledWith(input)

      bump.set(1)
      await wrap(tick())

      // stable identity -> the framework does not detach/reattach the ref
      expect(new Set(boundRefs).size).toBe(1)
      expect(refSpy).toHaveBeenCalledTimes(1) // no null -> element churn

      render(null, root)
      await wrap(tick())
      expect(refSpy).toHaveBeenCalledTimes(2)
      expect(refSpy).toHaveBeenLastCalledWith(null)
    }))

  test('calls the latest passthrough onBlur after re-render', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'latestBlurForm')
      const bump = atom(0, 'bump')
      const calls: number[] = []
      const boundBlurs: Array<() => void> = []

      const Form = reatomComponent(() => {
        const version = bump()
        const bound = bindField(form.fields.name, {
          onBlur: () => calls.push(version),
        })
        boundBlurs.push(bound.onBlur)
        return <input data-testid="name" {...bound} />
      }, 'Form')

      mount(<Form />)
      await wrap(tick())

      bump.set(1)
      await wrap(tick())

      const input = getInput()
      input.focus()
      input.blur()
      await wrap(tick())

      expect(new Set(boundBlurs).size).toBe(1) // stable identity
      expect(calls).toEqual([1]) // latest closure, not the stale 0
    }))

  test('updates the field and calls the passthrough onChange', () =>
    context.start(async () => {
      const form = reatomForm({ name: '' }, 'changeForm')
      const changeSpy = vi.fn()
      const Form = reatomComponent(
        () => (
          <input
            data-testid="name"
            {...bindField(form.fields.name, { onChange: changeSpy })}
          />
        ),
        'Form',
      )

      mount(<Form />)
      await wrap(tick())

      const input = getInput()
      fireChange(input, 'hello')
      await wrap(tick())

      expect(form.fields.name.value()).toBe('hello')
      expect(input.value).toBe('hello')
      expect(changeSpy).toHaveBeenCalledTimes(1)
    }))
})
