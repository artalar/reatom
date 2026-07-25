/*
Respectfully copied from https://github.com/ryansolid/dom-expressions/blob/ae71a417aa13b33517082628aff09513629df8b2/packages/dom-expressions/src/jsx.d.ts
*/

import type {
  Action,
  Atom,
  AtomLike,
  FieldAtom,
  FieldLikeAtom,
  LinkedList,
  LLNode,
} from '@reatom/core'
import type * as csstype from 'csstype'

/** Minimal field shape for `model:field` binding in JSX. */
export type FieldModelBinding = Pick<
  FieldAtom,
  'change' | 'value' | 'focus' | 'disabled' | 'elementRef'
>

/** Minimal form shape for `<form model={...}>` binding in JSX. */
export type FormModelBinding = {
  submit: Action<any[], any> & {
    ready: AtomLike<boolean>
    error: AtomLike<Error | undefined>
  }
  submitted: Atom<boolean>
  fields: Record<string, FieldLikeAtom>
}

type Primitive =
  | (string & {})
  | number
  | boolean
  | null
  | undefined

type LinkedListJSXAtom = AtomLike<LinkedList<LLNode<Element>>> & {__reatomLinkedList: true}

type AtomOrGetterMaybe<T = any> = T | AtomLike<T> | (() => T)

// TODO write it manually to improve perf
export type AttributesAtomMaybe<T extends Record<keyof any, any>> = {
  [K in keyof T]: K extends `on:${string}` | 'ref'
    ? T[K]
    : AtomOrGetterMaybe<T[K]>
}

// TODO write it manually to improve perf
type ElementsAttributesAtomMaybe<T extends Record<keyof any, any>> = {
  [K in keyof T]: AttributesAtomMaybe<T[K]>
}

export namespace JSX {
  type ClassNameValue = AtomOrGetterMaybe<
    | Primitive
    | Array<ClassNameValue>
    | AtomLike<T>
    | Record<string, unknown>
    | (() => ClassNameValue)
  >

  type Element = HTMLElement | SVGElement

  type ElementChildren = AtomOrGetterMaybe<
    | Primitive
    | ChildNode
    | Array<ElementChildren>
  >

  interface ElementClass {
    // empty, libs can define requirements downstream
  }

  interface ElementAttributes<T> {
    [k: `attr:${string}`]: unknown
  }

  interface ElementProperties<T> {
    [k: `prop:${string}`]: unknown
  }

  interface $Spread<T> {
    /**
     * A reactive plain prop record. The record may come from a headless model,
     * so it is intentionally structural instead of requiring this element's
     * template-literal index signatures.
     */
    $spread?: AtomOrGetterMaybe<object>
  }

  interface ElementChildrenAttribute {
    children: {}
  }

  interface CssAttributes {
    css?: string | null | undefined
    /**
     * Custom properties.
     * @example
     * // <div style="--size: 16px; font-size: var(--size);"></div>
     * <div css:size="16px" css="font-size: var(--size);"></div>
     */
    [css: `css:${string}`]: string | number | false | null | undefined
  }

  interface EventHandler<T, E extends Event = Event> {
    (
      e: E & {
        currentTarget: T
        target: Element
      },
    ): void
  }

  interface MouseEventHandler<
    T extends Element = Element,
    E extends MouseEvent = MouseEvent,
  > {
    (
      e: E & {
        currentTarget: T
        target: Element
      },
    ): void
  }

  interface InputEventHandler<
    T = HTMLInputElement,
    E extends InputEvent = InputEvent,
  > {
    (
      e: E & {
        currentTarget: T
        target: T extends
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          ? T
          : Element
      },
    ): void
  }

  interface ChangeEventHandler<T = HTMLInputElement, E extends Event = Event> {
    (
      e: E & {
        currentTarget: T
        target: T extends
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          ? T
          : Element
      },
    ): void
  }

  interface FocusEventHandler<
    T = HTMLInputElement,
    E extends FocusEvent = FocusEvent,
  > {
    (
      e: E & {
        currentTarget: T
        target: T extends
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          ? T
          : Element
      },
    ): void
  }

  // const SERIALIZABLE: unique symbol
  // interface SerializableAttributeValue {
  //   toString(): string
  //   [SERIALIZABLE]: never
  // }

  interface IntrinsicAttributes {
    // TODO?
    // ref?: (e: unknown) => void | (() => any)
  }
  interface CustomAttributes<T> {
    ref?: (el: T) => void | ((el: T) => any)
    // classList?: {
    //   [k: string]: boolean | undefined
    // }
  }
  interface Directives {}
  interface DirectiveFunctions {
    [x: string]: (el: Element, accessor: AtomLike<any>) => void
  }
  interface ExplicitProperties {}
  interface ExplicitAttributes {}
  interface CustomEvents {}
  type DirectiveAttributes = {
    [Key in keyof Directives as `use:${Key}`]?: Directives[Key]
  }
  type DirectiveFunctionAttributes<T> = {
    [K in keyof DirectiveFunctions as string extends K
      ? never
      : `use:${K}`]?: DirectiveFunctions[K] extends (
      el: infer E, // will be unknown if not provided
      ...rest: infer R // use rest so that we can check whether it's provided or not
    ) => void
      ? T extends E // everything extends unknown if E is unknown
        ? R extends [infer A] // check if has accessor provided
          ? A extends AtomLike<infer V>
            ? V // it's an accessor
            : never // it isn't, type error
          : true // no accessor provided
        : never // T is the wrong element
      : never // it isn't a function
  }
  type PropAttributes = {
    [Key in keyof ExplicitProperties as `prop:${Key}`]?: AtomOrGetterMaybe<
      ExplicitProperties[Key]
    >
  }
  type AttrAttributes = {
    [Key in keyof ExplicitAttributes as `attr:${Key}`]?: AtomOrGetterMaybe<
      ExplicitAttributes[Key]
    >
  }
  type OnAttributes<T> = {
    [Key in keyof CustomEvents as `on:${Key}`]?: EventHandler<
      T,
      CustomEvents[Key]
    > | null | undefined
  }
  interface DOMAttributes<T>
    extends CustomAttributes<T>,
      DirectiveAttributes,
      DirectiveFunctionAttributes<T>,
      PropAttributes,
      AttrAttributes,
      OnAttributes<T>,
      CustomEventHandlers<T> {
    children?: ElementChildren | LinkedListJSXAtom
    innerHTML?: string | null | undefined
    innerText?: string | number | null | undefined
    textContent?: string | number | null | undefined
  }
  /**
   * @type {GlobalEventHandlers}
   */
  interface CustomEventHandlers<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Node/selectstart_event
     */
    'on:selectstart'?: EventHandler<T, Event> | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/afterscriptexecute_event
     * @deprecated
     */
    'on:afterscriptexecute'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationcancel_event
     */
    'on:animationcancel'?: EventHandler<T, AnimationEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event
     */
    'on:animationend'?: EventHandler<T, AnimationEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationiteration_event
     */
    'on:animationiteration'?: EventHandler<T, AnimationEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationstart_event
     */
    'on:animationstart'?: EventHandler<T, AnimationEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event
     */
    'on:auxclick'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event
     */
    'on:beforeinput'?: EventHandler<T, InputEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/beforematch_event
     */
    'on:beforematch'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/beforescriptexecute_event
     * @deprecated
     */
    'on:beforescriptexecute'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/beforexrselect_event
     * @todo Replace to XRSessionEvent.
     */
    'on:beforexrselect'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event
     */
    'on:blur'?: EventHandler<T, FocusEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
     */
    'on:click'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event
     */
    'on:compositionend'?: EventHandler<T, CompositionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event
     */
    'on:compositionstart'?: EventHandler<T, CompositionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionupdate_event
     */
    'on:compositionupdate'?: EventHandler<T, CompositionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/contentvisibilityautostatechange_event
     */
    'on:contentvisibilityautostatechange'?: EventHandler<T, ContentVisibilityAutoStateChangeEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
     */
    'on:contextmenu'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/copy_event
     */
    'on:copy'?: EventHandler<T, ClipboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/cut_event
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/cut_event
     */
    'on:cut'?: EventHandler<T, ClipboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event
     */
    'on:dblclick'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/DOMActivate_event
     * @deprecated
     */
    'on:DOMActivate'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/DOMMouseScroll_event
     * @deprecated
     */
    'on:DOMMouseScroll'?: EventHandler<T, WheelEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event
     */
    'on:focus'?: EventHandler<T, FocusEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event
     */
    'on:focusin'?: EventHandler<T, FocusEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event
     */
    'on:focusout'?: EventHandler<T, FocusEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenchange_event
     */
    'on:fullscreenchange'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/fullscreenerror_event
     */
    'on:fullscreenerror'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/gesturechange_event
     * @todo Replace to GestureEvent.
     */
    'on:gesturechange'?: EventHandler<T, UIEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/gestureend_event
     * @todo Replace to GestureEvent.
     */
    'on:gestureend'?: EventHandler<T, UIEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/gesturestart_event
     * @todo Replace to GestureEvent.
     */
    'on:gesturestart'?: EventHandler<T, UIEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/gotpointercapture_event
     */
    'on:gotpointercapture'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event
     */
    'on:input'?: EventHandler<T, InputEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
     */
    'on:keydown'?: EventHandler<T, KeyboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event
     * @deprecated
     */
    'on:keypress'?: EventHandler<T, KeyboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
     */
    'on:keyup'?: EventHandler<T, KeyboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/lostpointercapture_event
     */
    'on:lostpointercapture'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event
     */
    'on:mousedown'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event
     */
    'on:mouseenter'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event
     */
    'on:mouseleave'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
     */
    'on:mousemove'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseout_event
     */
    'on:mouseout'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseover_event
     */
    'on:mouseover'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event
     */
    'on:mouseup'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousewheel_event
     * @deprecated
     */
    'on:mousewheel'?: EventHandler<T, WheelEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/MozMousePixelScroll_event
     * @deprecated
     */
    'on:MozMousePixelScroll'?: EventHandler<T, WheelEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/paste_event
     */
    'on:paste'?: EventHandler<T, ClipboardEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
     */
    'on:pointercancel'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event
     */
    'on:pointerdown'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerenter_event
     */
    'on:pointerenter'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerleave_event
     */
    'on:pointerleave'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event
     */
    'on:pointermove'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerout_event
     */
    'on:pointerout'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerover_event
     */
    'on:pointerover'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerrawupdate_event
     */
    'on:pointerrawupdate'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerup_event
     */
    'on:pointerup'?: EventHandler<T, PointerEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event
     */
    'on:scroll'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event
     */
    'on:scrollend'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event
     * @todo Replace to SnapEvent.
     */
    'on:scrollsnapchange'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchanging_event
     * @todo Replace to SnapEvent.
     */
    'on:scrollsnapchanging'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/securitypolicyviolation_event
     */
    'on:securitypolicyviolation'?: EventHandler<T, SecurityPolicyViolationEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchcancel_event
     */
    'on:touchcancel'?: EventHandler<T, TouchEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchend_event
     */
    'on:touchend'?: EventHandler<T, TouchEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchmove_event
     */
    'on:touchmove'?: EventHandler<T, TouchEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/touchstart_event
     */
    'on:touchstart'?: EventHandler<T, TouchEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitioncancel_event
     */
    'on:transitioncancel'?: EventHandler<T, TransitionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event
     */
    'on:transitionend'?: EventHandler<T, TransitionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionrun_event
     */
    'on:transitionrun'?: EventHandler<T, TransitionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionstart_event
     */
    'on:transitionstart'?: EventHandler<T, TransitionEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/webkitmouseforcechanged_event
     */
    'on:webkitmouseforcechanged'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/webkitmouseforcedown_event
     */
    'on:webkitmouseforcedown'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/webkitmouseforceup_event
     */
    'on:webkitmouseforceup'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/webkitmouseforcewillbegin_event
     */
    'on:webkitmouseforcewillbegin'?: EventHandler<T, MouseEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
     */
    'on:wheel'?: EventHandler<T, WheelEvent> | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforetoggle_event
     */
    'on:beforetoggle'?: EventHandler<T, ToggleEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
     */
    'on:change'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/command_event
     * @todo Replace to CommandEvent.
     */
    'on:command'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drag_event
     */
    'on:drag'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragend_event
     */
    'on:dragend'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragenter_event
     */
    'on:dragenter'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragleave_event
     */
    'on:dragleave'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event
     */
    'on:dragover'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragstart_event
     */
    'on:dragstart'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drop_event
     */
    'on:drop'?: EventHandler<T, DragEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event
     */
    'on:error'?: EventHandler<T, UIEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event
     */
    'on:load'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/toggle_event
     */
    'on:toggle'?: EventHandler<T, ToggleEvent> | null | undefined
  }

  /** Controls automatic capitalization in inputted text. */
  type HTMLAutocapitalize =
    | 'off'
    | 'none'
    | 'on'
    | 'sentences'
    | 'words'
    | 'characters'
  // TODO add combinations
  /**
   * The autocomplete attribute provides a hint to the user agent specifying how to, or indeed whether to, prefill a form control.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#token_list_tokens
   */
  type HTMLAutocomplete =
    | 'additional-name'
    | 'address-level1'
    | 'address-level2'
    | 'address-level3'
    | 'address-level4'
    | 'address-line1'
    | 'address-line2'
    | 'address-line3'
    | 'bday-day'
    | 'bday-month'
    | 'bday-year'
    | 'bday'
    | 'billing'
    | 'cc-additional-name'
    | 'cc-csc'
    | 'cc-exp-month'
    | 'cc-exp-year'
    | 'cc-exp'
    | 'cc-family-name'
    | 'cc-given-name'
    | 'cc-name'
    | 'cc-number'
    | 'cc-type'
    | 'country-name'
    | 'country'
    | 'current-password'
    | 'email'
    | 'family-name'
    | 'fax'
    | 'given-name'
    | 'home'
    | 'honorific-prefix'
    | 'honorific-suffix'
    | 'impp'
    | 'language'
    | 'mobile'
    | 'name'
    | 'new-password'
    | 'nickname'
    | 'one-time-code'
    | 'organization-title'
    | 'organization'
    | 'page'
    | 'photo'
    | 'postal-code'
    | 'sex'
    | 'shipping'
    | 'street-address'
    | 'tel-area-code'
    | 'tel-country-code'
    | 'tel-extension'
    | 'tel-local-prefix'
    | 'tel-local-suffix'
    | 'tel-local'
    | 'tel-national'
    | 'tel'
    | 'transaction-amount'
    | 'transaction-currency'
    | 'url'
    | 'username'
    | 'webauthn'
    | 'work'
    | `section-${string}`
    | (string & {})
  type HTMLDir = 'ltr' | 'rtl' | 'auto'
  type HTMLFormEncType =
    | 'application/x-www-form-urlencoded'
    | 'multipart/form-data'
    | 'text/plain'
  type HTMLFormMethod = 'post' | 'get' | 'dialog'
  type HTMLCrossorigin = 'anonymous' | 'use-credentials'
  type HTMLReferrerPolicy =
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
  type HTMLIframeSandbox =
    | 'allow-downloads-without-user-activation'
    | 'allow-downloads'
    | 'allow-forms'
    | 'allow-modals'
    | 'allow-orientation-lock'
    | 'allow-pointer-lock'
    | 'allow-popups'
    | 'allow-popups-to-escape-sandbox'
    | 'allow-presentation'
    | 'allow-same-origin'
    | 'allow-scripts'
    | 'allow-storage-access-by-user-activation'
    | 'allow-top-navigation'
    | 'allow-top-navigation-by-user-activation'
    | 'allow-top-navigation-to-custom-protocols'
  type HTMLLinkAs =
    | 'audio'
    | 'document'
    | 'embed'
    | 'fetch'
    | 'font'
    | 'image'
    | 'object'
    | 'script'
    | 'style'
    | 'track'
    | 'video'
    | 'worker'
  type HTMLTarget =
    | '_blank'
    | '_parent'
    | '_self'
    | '_top'
    | '_unfencedTop'
  type HTMLAnchorRel =
    | 'alternate'
    | 'author'
    | 'bookmark'
    | 'external'
    | 'help'
    | 'license'
    | 'me'
    | 'next'
    | 'nofollow'
    | 'noopener'
    | 'noreferrer'
    | 'opener'
    | 'prev'
    | 'privacy-policy'
    | 'search'
    | 'tag'
    | 'terms-of-service'
  type HTMLLinkRel =
    | 'alternate'
    | 'author'
    | 'canonical'
    | 'compression-dictionary'
    | 'dns-prefetch'
    | 'expect'
    | 'help'
    | 'icon'
    | 'license'
    | 'manifest'
    | 'me'
    | 'modulepreload'
    | 'next'
    | 'pingback'
    | 'preconnect'
    | 'prefetch'
    | 'preload'
    | 'prerender'
    | 'prev'
    | 'privacy-policy'
    | 'search'
    | 'stylesheet'
    | 'terms-of-service'
  type HTMLFormRel =
    | 'external'
    | 'help'
    | 'license'
    | 'next'
    | 'nofollow'
    | 'noopener'
    | 'noreferrer'
    | 'opener'
    | 'prev'
    | 'search'

  /**
   * All the WAI-ARIA 1.2 role attribute values from
   * @see https://www.w3.org/TR/wai-aria-1.2/#role_definitions
   */
  type WAIAriaRole =
    | 'alert'
    | 'alertdialog'
    | 'application'
    | 'article'
    | 'banner'
    | 'blockquote'
    | 'button'
    | 'caption'
    | 'cell'
    | 'checkbox'
    | 'code'
    | 'columnheader'
    | 'combobox'
    | 'command'
    | 'complementary'
    | 'composite'
    | 'contentinfo'
    | 'definition'
    | 'deletion'
    | 'dialog'
    | 'directory'
    | 'document'
    | 'emphasis'
    | 'feed'
    | 'figure'
    | 'form'
    | 'grid'
    | 'gridcell'
    | 'group'
    | 'heading'
    | 'img'
    | 'input'
    | 'insertion'
    | 'landmark'
    | 'link'
    | 'list'
    | 'listbox'
    | 'listitem'
    | 'log'
    | 'main'
    | 'marquee'
    | 'math'
    | 'menu'
    | 'menubar'
    | 'menuitem'
    | 'menuitemcheckbox'
    | 'menuitemradio'
    | 'meter'
    | 'navigation'
    | 'none'
    | 'note'
    | 'option'
    | 'paragraph'
    | 'presentation'
    | 'progressbar'
    | 'radio'
    | 'radiogroup'
    | 'range'
    | 'region'
    | 'roletype'
    | 'row'
    | 'rowgroup'
    | 'rowheader'
    | 'scrollbar'
    | 'search'
    | 'searchbox'
    | 'section'
    | 'sectionhead'
    | 'select'
    | 'separator'
    | 'slider'
    | 'spinbutton'
    | 'status'
    | 'strong'
    | 'structure'
    | 'subscript'
    | 'superscript'
    | 'switch'
    | 'tab'
    | 'table'
    | 'tablist'
    | 'tabpanel'
    | 'term'
    | 'textbox'
    | 'time'
    | 'timer'
    | 'toolbar'
    | 'tooltip'
    | 'tree'
    | 'treegrid'
    | 'treeitem'
    | 'widget'
    | 'window'
    | 'none presentation'

  /**
   * All the Digital Publishing WAI-ARIA 1.0 role attribute values
   * @see https://www.w3.org/TR/dpub-aria-1.0/#role_definitions
   */
  export type DPubAriaRole =
    | 'doc-abstract'
    | 'doc-acknowledgments'
    | 'doc-afterword'
    | 'doc-appendix'
    | 'doc-backlink'
    | 'doc-biblioentry'
    | 'doc-bibliography'
    | 'doc-biblioref'
    | 'doc-chapter'
    | 'doc-colophon'
    | 'doc-conclusion'
    | 'doc-cover'
    | 'doc-credit'
    | 'doc-credits'
    | 'doc-dedication'
    | 'doc-endnote'
    | 'doc-endnotes'
    | 'doc-epigraph'
    | 'doc-epilogue'
    | 'doc-errata'
    | 'doc-example'
    | 'doc-footnote'
    | 'doc-foreword'
    | 'doc-glossary'
    | 'doc-glossref'
    | 'doc-index'
    | 'doc-introduction'
    | 'doc-noteref'
    | 'doc-notice'
    | 'doc-pagebreak'
    | 'doc-pagelist'
    | 'doc-part'
    | 'doc-preface'
    | 'doc-prologue'
    | 'doc-pullquote'
    | 'doc-qna'
    | 'doc-subtitle'
    | 'doc-tip'
    | 'doc-toc'

  type AriaRole = WAIAriaRole | DPubAriaRole

  /**
   * @see https://www.w3.org/TR/wai-aria-1.1/
   */
  interface AriaAttributes {
    /**
     * Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application.
     */
    'aria-activedescendant'?: string | null | undefined
    /**
     * Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaAtomic
     * @alias ariaAtomic
     */
    'aria-atomic'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
     * presented if they are made.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaAutoComplete
     * @alias ariaAutoComplete
     */
    'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | null | undefined
    /**
     * Defines a string value that labels the current element, which is intended to be converted into Braille.
     * @see aria-label
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaBrailleLabel
     * @alias ariaBrailleLabel
     */
    'aria-braillelabel'?: string | null | undefined
    /**
     * Defines a human-readable, author-localized abbreviated description for the role of an element, which is intended to be converted into Braille.
     * @see aria-roledescription
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaBrailleRoleDescription
     * @alias ariaBrailleRoleDescription
     */
    'aria-brailleroledescription'?: string | null | undefined
    /**
     * Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaBusy
     * @alias ariaBusy
     */
    'aria-busy'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
     * @see aria-pressed
     * @see aria-selected
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaChecked
     * @alias ariaChecked
     */
    'aria-checked'?: boolean | 'false' | 'true' | 'mixed' | null | undefined
    /**
     * Defines the total number of columns in a table, grid, or treegrid.
     * @see aria-colindex
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaColCount
     * @alias ariaColCount
     */
    'aria-colcount'?: `${number}` | number | null | undefined
    /**
     * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
     * @see aria-colcount
     * @see aria-colspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaColIndex
     * @alias ariaColIndex
     */
    'aria-colindex'?: `${number}` | number | null | undefined
    /**
     * Defines a human readable text alternative of aria-colindex.
     * @see aria-rowindextext
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaColIndexText
     * @alias ariaColIndexText
     */
    'aria-colindextext'?: string | null | undefined
    /**
     * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-colindex
     * @see aria-rowspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaColSpan
     * @alias ariaColSpan
     */
    'aria-colspan'?: `${number}` | number | null | undefined
    /**
     * Identifies the element (or elements) whose contents or presence are controlled by the current element.
     * @see aria-owns
     */
    'aria-controls'?: string | null | undefined
    /**
     * Indicates the element that represents the current item within a container or set of related elements.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaCurrent
     * @alias ariaCurrent
     */
    'aria-current'?:
      | boolean
      | 'false'
      | 'true'
      | 'page'
      | 'step'
      | 'location'
      | 'date'
      | 'time'
      | null
      | undefined
    /**
     * Identifies the element (or elements) that describes the object.
     * @see aria-labelledby
     */
    'aria-describedby'?: string | null | undefined
    /**
     * Defines a string value that describes or annotates the current element.
     * @see aria-describedby
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaDescription
     * @alias ariaDescription
     */
    'aria-description'?: string | null | undefined
    /**
     * Identifies the element that provides a detailed, extended description for the object.
     * @see aria-describedby
     */
    'aria-details'?: string | null | undefined
    /**
     * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
     * @see aria-hidden
     * @see aria-readonly
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaDisabled
     * @alias ariaDisabled
     */
    'aria-disabled'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates what functions can be performed when a dragged object is released on the drop target.
     * @deprecated in ARIA 1.1
     */
    'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | null | undefined
    /**
     * Identifies the element that provides an error message for the object.
     * @see aria-invalid
     * @see aria-describedby
     */
    'aria-errormessage'?: string | null | undefined
    /**
     * Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaExpanded
     * @alias ariaExpanded
     */
    'aria-expanded'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
     * allows assistive technology to override the general default of reading in document source order.
     */
    'aria-flowto'?: string | null | undefined
    /**
     * Indicates an element's "grabbed" state in a drag-and-drop operation.
     * @deprecated in ARIA 1.1
     */
    'aria-grabbed'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaHasPopup
     * @alias ariaHasPopup
     */
    'aria-haspopup'?:
      | boolean
      | 'false'
      | 'true'
      | 'menu'
      | 'listbox'
      | 'tree'
      | 'grid'
      | 'dialog'
      | null
      | undefined
    /**
     * Indicates whether the element is exposed to an accessibility API.
     * @see aria-disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaHidden
     * @alias ariaHidden
     */
    'aria-hidden'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates the entered value does not conform to the format expected by the application.
     * @see aria-errormessage
     */
    'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling' | null | undefined
    /**
     * Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaKeyShortcuts
     * @alias ariaKeyShortcuts
     */
    'aria-keyshortcuts'?: string | null | undefined
    /**
     * Defines a string value that labels the current element.
     * @see aria-labelledby
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabel
     * @alias ariaLabel
     */
    'aria-label'?: string | null | undefined
    /**
     * Identifies the element (or elements) that labels the current element.
     * @see aria-describedby
     */
    'aria-labelledby'?: string | null | undefined
    /**
     * Defines the hierarchical level of an element within a structure.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLevel
     * @alias ariaLevel
     */
    'aria-level'?: `${number}` | number | null | undefined
    /**
     * Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLive
     * @alias ariaLive
     */
    'aria-live'?: 'off' | 'assertive' | 'polite' | null | undefined
    /**
     * Indicates whether an element is modal when displayed.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaModal
     * @alias ariaModal
     */
    'aria-modal'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates whether a text box accepts multiple lines of input or only a single line.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaMultiLine
     * @alias ariaMultiLine
     */
    'aria-multiline'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates that the user may select more than one item from the current selectable descendants.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaMultiSelectable
     * @alias ariaMultiSelectable
     */
    'aria-multiselectable'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaOrientation
     * @alias ariaOrientation
     */
    'aria-orientation'?: 'horizontal' | 'vertical' | null | undefined
    /**
     * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
     * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
     * @see aria-controls
     */
    'aria-owns'?: string | null | undefined
    /**
     * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
     * A hint could be a sample value or a brief description of the expected format.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaPlaceholder
     * @alias ariaPlaceholder
     */
    'aria-placeholder'?: string | null | undefined
    /**
     * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-setsize
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaPosInSet
     * @alias ariaPosInSet
     */
    'aria-posinset'?: `${number}` | number | null | undefined
    /**
     * Indicates the current "pressed" state of toggle buttons.
     * @see aria-checked
     * @see aria-selected
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaPressed
     * @alias ariaPressed
     */
    'aria-pressed'?: boolean | 'false' | 'true' | 'mixed' | null | undefined
    /**
     * Indicates that the element is not editable, but is otherwise operable.
     * @see aria-disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaReadOnly
     * @alias ariaReadOnly
     */
    'aria-readonly'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
     * @see aria-atomic
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRelevant
     * @alias ariaRelevant
     */
    'aria-relevant'?:
      | 'additions'
      | 'additions removals'
      | 'additions text'
      | 'all'
      | 'removals'
      | 'removals additions'
      | 'removals text'
      | 'text'
      | 'text additions'
      | 'text removals'
      | null
      | undefined
    /**
     * Indicates that user input is required on the element before a form may be submitted.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRequired
     * @alias ariaRequired
     */
    'aria-required'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Defines a human-readable, author-localized description for the role of an element.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRoleDescription
     * @alias ariaRoleDescription
     */
    'aria-roledescription'?: string | null | undefined
    /**
     * Defines the total number of rows in a table, grid, or treegrid.
     * @see aria-rowindex
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRowCount
     * @alias ariaRowCount
     */
    'aria-rowcount'?: `${number}` | number | null | undefined
    /**
     * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
     * @see aria-rowcount
     * @see aria-rowspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRowIndex
     * @alias ariaRowIndex
     */
    'aria-rowindex'?: `${number}` | number | null | undefined
    /**
     * Defines a human readable text alternative of aria-rowindex.
     * @see aria-colindextext
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRowIndexText
     * @alias ariaRowIndexText
     */
    'aria-rowindextext'?: string | null | undefined
    /**
     * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-rowindex
     * @see aria-colspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaRowSpan
     * @alias ariaRowSpan
     */
    'aria-rowspan'?: `${number}` | number | null | undefined
    /**
     * Indicates the current "selected" state of various widgets.
     * @see aria-checked
     * @see aria-pressed
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaSelected
     * @alias ariaSelected
     */
    'aria-selected'?: boolean | 'false' | 'true' | null | undefined
    /**
     * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-posinset
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaSetSize
     * @alias ariaSetSize
     */
    'aria-setsize'?: `${number}` | number | null | undefined
    /**
     * Indicates if items in a table or grid are sorted in ascending or descending order.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaSort
     * @alias ariaSort
     */
    'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | null | undefined
    /**
     * Defines the maximum allowed value for a range widget.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaValueMax
     * @alias ariaValueMax
     */
    'aria-valuemax'?: `${number}` | number | null | undefined
    /**
     * Defines the minimum allowed value for a range widget.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaValueMin
     * @alias ariaValueMin
     */
    'aria-valuemin'?: `${number}` | number | null | undefined
    /**
     * Defines the current value for a range widget.
     * @see aria-valuetext.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaValueNow
     * @alias ariaValueNow
     */
    'aria-valuenow'?: `${number}` | number | null | undefined
    /**
     * Defines the human readable text alternative of aria-valuenow for a range widget.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaValueText
     * @alias ariaValueText
     */
    'aria-valuetext'?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/role
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/role
     */
    role?: AriaRole | null | undefined
  }

  // TODO: Should we allow this?
  // type ClassKeys = `class:${string}`;
  type StylePropertiesKeys = Exclude<
    keyof csstype.PropertiesHyphen,
    `-${string}`
  >
  /** @todo Should we use `csstype.PropertiesHyphenFallback`? */
  type StyleProperties = {
    [key in StylePropertiesKeys]?: csstype.PropertiesHyphen[key] | null
  }
  type StylePropertyAttributes = {
    [key in StylePropertiesKeys as `style:${key}`]?: StyleProperties[key]
  }

  interface CSSProperties extends StyleProperties {
    // Override
    [key: `-${string}`]: string | number | null | undefined
  }

  interface HTMLAttributes<T = HTMLElement>
    extends AriaAttributes,
      DOMAttributes<T>,
      CssAttributes,
      StylePropertyAttributes,
      ElementAttributes<T>,
      ElementProperties<T>,
      $Spread<T> {
    // [key: ClassKeys]: boolean;
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/data-*
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
     */
    [key: `data-${string}`]: string | number | boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/accesskey
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/accessKey
     * @alias accessKey
     */
    accesskey?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/anchor
     */
    anchor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autocapitalize
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/autocapitalize
     */
    autocapitalize?: HTMLAutocapitalize | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autocorrect
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/autocorrect
     * @todo Support for attribute values '' | 'on' | 'off'.
     */
    autocorrect?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autofocus
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/autofocus
     */
    autofocus?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/class
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/className
     * @alias className
     */
    class?: ClassNameValue
    /**
     * @alias class
     */
    className?: ClassNameValue
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/contentEditable
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/isContentEditable
     * @alias contentEditable
     */
    contenteditable?: boolean | '' | 'false' | 'true' | 'plaintext-only' | null | undefined
    /**
     * @deprecated https://github.com/whatwg/html/issues/2730
     */
    contextmenu?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dir
     */
    dir?: HTMLDir | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/draggable
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/draggable
     * @todo Support for attribute values 'false' | 'true'.
     */
    draggable?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/enterKeyHint
     * @alias enterKeyHint
     */
    enterkeyhint?:
      | 'enter'
      | 'done'
      | 'go'
      | 'next'
      | 'previous'
      | 'search'
      | 'send'
      | null
      | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts
     */
    exportparts?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/hidden
     * @todo Support for attribute values '' | 'hidden'.
     */
    hidden?: boolean | 'until-found' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/id
     */
    id?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
     */
    inert?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inputMode
     * @alias inputMode
     */
    inputmode?:
      | 'none'
      | 'text'
      | 'tel'
      | 'url'
      | 'email'
      | 'numeric'
      | 'decimal'
      | 'search'
      | null
      | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/is
     */
    is?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemid
     */
    itemid?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemprop
     */
    itemprop?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemref
     */
    itemref?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemscope
     */
    itemscope?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/itemtype
     */
    itemtype?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lang
     */
    lang?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/part
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/part
     */
    part?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/popover
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/popover
     */
    popover?: 'auto' | 'hint' | 'manual' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/slot
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/slot
     */
    slot?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/spellcheck
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/spellcheck
     * @todo Support for attribute values '' | 'false' | 'true'?
     */
    spellcheck?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/style
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style
     */
    style?: CSSProperties | string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/tabIndex
     * @alias tabIndex
     */
    tabindex?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/title
     */
    title?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/translate
     * @todo Support for attribute values '' | 'no' | 'yes'?
     */
    translate?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/virtualkeyboardpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/virtualKeyboardPolicy
     * @alias virtualKeyboardPolicy
     */
    virtualkeyboardpolicy?: boolean | '' | 'auto' | 'manual' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/writingsuggestions
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/writingSuggestions
     * @alias writingSuggestions
     */
    writingsuggestions?: boolean | 'false' | 'true' | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/elementtiming
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/elementTiming
     */
    elementtiming?: string | null | undefined

    // RDFa Attributes
    about?: string | null | undefined
    datatype?: string | null | undefined
    inlist?: any | null | undefined
    prefix?: string | null | undefined
    property?: string | null | undefined
    resource?: string | null | undefined
    typeof?: string | null | undefined
    vocab?: string | null | undefined
  }
  interface AnchorHTMLAttributes<T = HTMLElementTagNameMap['a']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#attributionsrc
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/attributionSrc
     * @alias attributionSrc
     */
    attributionsrc?: boolean | string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download
     */
    download?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#href
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/href
     */
    href?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#hreflang
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/hreflang
     */
    hreflang?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#ping
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/ping
     */
    ping?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/relList
     * @todo Should support for values HTMLAnchorRel[]?
     */
    rel?: HTMLAnchorRel | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#target
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/target
     */
    target?: HTMLTarget | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/type
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    type?: string | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#charset
     * @deprecated
     */
    charset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#coords
     * @deprecated
     */
    coords?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#name
     * @deprecated
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#rev
     * @deprecated
     */
    rev?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#shape
     * @deprecated
     */
    shape?: string | null | undefined
  }
  interface AudioHTMLAttributes<T> extends MediaHTMLAttributes<T> {}
  interface AreaHTMLAttributes<T = HTMLElementTagNameMap['area']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#alt
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/alt
     */
    alt?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#coords
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/coords
     */
    coords?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#download
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/download
     */
    download?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#href
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/href
     */
    href?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#ping
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/ping
     */
    ping?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/relList
     * @todo Should support for values HTMLAnchorRel[]?
     */
    rel?: HTMLAnchorRel | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#shape
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/shape
     */
    shape?: 'rect' | 'circle' | 'poly' | 'default' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/area#target
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLAreaElement/target
     */
    target?: HTMLTarget | (string & {}) | null | undefined
  }
  interface BaseHTMLAttributes<T = HTMLElementTagNameMap['base']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/base#href
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLBaseElement/href
     */
    href?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/base#target
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLBaseElement/target
     */
    target?: HTMLTarget | (string & {}) | null | undefined
  }
  interface BlockquoteHTMLAttributes<T = HTMLElementTagNameMap['blockquote']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/blockquote#cite
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLQuoteElement/cite
     */
    cite?: string | null | undefined
  }
  interface ButtonHTMLAttributes<T = HTMLElementTagNameMap['button']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#command
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/command
     */
    command?:
      | 'show-modal'
      | 'close'
      | 'request-close'
      | 'show-popover'
      | 'hide-popover'
      | 'toggle-popover'
      | `--${string}`
      | null
      | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#command
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/commandForElement
     * @alias commandForElement
     */
    commandfor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#formaction
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/formAction
     * @alias formAction
     */
    formaction?: string | null | undefined // | SerializableAttributeValue
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#formenctype
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/formEnctype
     * @alias formEnctype
     */
    formenctype?: HTMLFormEncType | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#formmethod
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/formMethod
     * @alias formMethod
     */
    formmethod?: HTMLFormMethod | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#formnovalidate
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/formNoValidate
     * @alias formNoValidate
     */
    formnovalidate?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#formtarget
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/formTarget
     * @alias formTarget
     */
    formtarget?: Omit<HTMLTarget, '_unfencedTop'> | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#popovertarget
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/popoverTargetElement
     * @alias popoverTargetElement
     */
    popovertarget?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#popovertargetaction
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/popoverTargetAction
     * @alias popoverTargetAction
     */
    popovertargetaction?: 'hide' | 'show' | 'toggle' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/type
     */
    type?: 'submit' | 'reset' | 'button' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement/value
     */
    value?: string | null | undefined
  }
  interface CanvasHTMLAttributes<T = HTMLElementTagNameMap['canvas']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/width
     */
    width?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/height
     */
    height?: `${number}` | number | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/contextlost_event
     */
    'on:contextlost'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/contextrestored_event
     */
    'on:contextrestored'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextcreationerror_event
     */
    'on:webglcontextcreationerror'?: EventHandler<T, WebGLContextEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event
     */
    'on:webglcontextlost'?: EventHandler<T, WebGLContextEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event
     */
    'on:webglcontextrestored'?: EventHandler<T, WebGLContextEvent> | null | undefined
  }
  interface DataHTMLAttributes<T = HTMLElementTagNameMap['data']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/data#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDataElement/value
     */
    value?: string | number | null | undefined
  }
  interface DelHTMLAttributes<T = HTMLElementTagNameMap['del']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/blockquote#cite
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLModElement/cite
     */
    cite?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/blockquote#datetime
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLModElement/dateTime
     * @alias dateTime
     */
    datetime?: string | null | undefined
  }
  interface DetailsHtmlAttributes<T = HTMLElementTagNameMap['details']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details#open
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/open
     */
    open?: boolean | null | undefined
  }
  interface DialogHtmlAttributes<T = HTMLElementTagNameMap['dialog']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#open
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/open
     */
    open?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/returnValue
     */
    returnValue?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#usage_notes
     */
    tabindex?: null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/cancel_event
     */
    'on:cancel'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/close_event
     */
    'on:close'?: EventHandler<T, Event> | null | undefined
  }
  interface EmbedHTMLAttributes<T = HTMLElementTagNameMap['embed']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/embed#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLEmbedElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/embed#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLEmbedElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/embed#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLEmbedElement/type
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    type?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/embed#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLEmbedElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface FencedFrameHTMLAttributes<T = HTMLElementTagNameMap['fencedframe']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fencedframe#allow
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFencedFrameElement/allow
     */
    allow?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFencedFrameElement/config
     */
    config?: FencedFrameConfig | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fencedframe#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFencedFrameElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fencedframe#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFencedFrameElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface FieldsetHTMLAttributes<T = HTMLElementTagNameMap['fieldset']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFieldSetElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFieldSetElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFieldSetElement/name
     */
    name?: string | null | undefined
  }
  interface FormHTMLAttributes<T = HTMLElementTagNameMap['form']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#accept-charset
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/acceptCharset
     * @alias acceptCharset
     */
    'accept-charset'?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#action
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/action
     */
    action?: string | null | undefined // | SerializableAttributeValue
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/autocomplete
     * @todo Should support for values boolean?
     */
    autocomplete?: '' | 'on' | 'off' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#enctype
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/encoding
     * @alias enctype
     */
    encoding?: HTMLFormEncType | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#enctype
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/enctype
     * @alias encoding
     */
    enctype?: HTMLFormEncType | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#method
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/method
     */
    method?: HTMLFormMethod | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#novalidate
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/noValidate
     * @alias noValidate
     */
    novalidate?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/relList
     * @todo Should support for values HTMLFormRel[]?
     */
    rel?: HTMLFormRel | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#target
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/target
     */
    target?: HTMLTarget | (string & {}) | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/formdata_event
     */
    'on:formdata'?: EventHandler<T, FormDataEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event
     */
    'on:reset'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event
     */
    'on:submit'?: EventHandler<T, SubmitEvent> | null | undefined
    /** Binds a {@link FormModelBinding}: auto submit, loading/submitted/error data attrs and classes. */
    model?: FormModelBinding
  }
  interface IframeHTMLAttributes<T = HTMLElementTagNameMap['iframe']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#allow
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/allow
     */
    allow?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#allowfullscreen
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/allowFullscreen
     * @alias allowFullscreen
     */
    allowfullscreen?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#allowpaymentrequest
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/allowPaymentRequest
     * @alias allowPaymentRequest
     * @deprecated
     */
    allowpaymentrequest?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#browsingtopics
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/browsingTopics
     * @alias browsingTopics
     */
    browsingtopics?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#credentialless
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/credentialless
     */
    credentialless?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#csp
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/csp
     */
    csp?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#loading
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/loading
     */
    loading?: 'eager' | 'lazy' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/sandbox
     */
    sandbox?: HTMLIframeSandbox | string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#srcdoc
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc
     */
    srcdoc?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface ImgHTMLAttributes<T = HTMLElementTagNameMap['img']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt
     */
    alt?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#attributionsrc
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/attributionSrc
     * @alias attributionSrc
     */
    attributionsrc?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
     * @alias crossOrigin
     */
    crossorigin?: HTMLCrossorigin | '' | boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#decoding
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
     */
    decoding?: 'sync' | 'async' | 'auto' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#fetchpriority
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority
     * @alias fetchPriority
     */
    fetchpriority?: 'high' | 'low' | 'auto' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#ismap
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/isMap
     * @alias isMap
     */
    ismap?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading
     */
    loading?: 'eager' | 'lazy' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#sizes
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/sizes
     */
    sizes?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#srcset
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/srcset
     */
    srcset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#usemap
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/useMap
     */
    usemap?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface InputHTMLAttributes<T = HTMLElementTagNameMap['input']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/accept
     */
    accept?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#alt
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/alt
     */
    alt?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/autocomplete
     * @todo Should support for values boolean?
     */
    autocomplete?: HTMLAutocomplete | '' | 'on' | 'off' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/capture
     * @todo Should support for values boolean?
     */
    capture?: '' | 'user' | 'environment' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#checked
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/checked
     */
    checked?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/dirname
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/dirName
     * @alias dirName
     */
    dirname?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#formaction
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/formAction
     * @alias formAction
     */
    formaction?: string | null | undefined // | SerializableAttributeValue
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#formenctype
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/formEnctype
     * @alias formEnctype
     */
    formenctype?: HTMLFormEncType | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#formmethod
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/formMethod
     * @alias formMethod
     */
    formmethod?: HTMLFormMethod | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#formnovalidate
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/formNoValidate
     * @alias formNoValidate
     */
    formnovalidate?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#formtarget
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/formTarget
     * @alias formTarget
     */
    formtarget?: Omit<HTMLTarget, '_unfencedTop'> | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/indeterminate
     */
    indeterminate?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#incremental
     */
    incremental?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#list
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/list
     * @todo Should support for values HTMLDataListElement?
     */
    list?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/max
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/max
     */
    max?: string | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/maxlength
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/maxLength
     * @alias maxLength
     */
    maxlength?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/min
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/min
     */
    min?: string | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/minlength
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/minlength
     * @alias minLength
     */
    minlength?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/multiple
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/multiple
     */
    multiple?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/pattern
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/pattern
     */
    pattern?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/placeholder
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/placeholder
     */
    placeholder?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#popovertarget
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/popoverTargetElement
     * @alias popoverTargetElement
     */
    popovertarget?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#popovertargetaction
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/popoverTargetAction
     * @alias popoverTargetAction
     */
    popovertargetaction?: 'hide' | 'show' | 'toggle' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/readonly
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/readOnly
     * @alias readOnly
     */
    readonly?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#results
     */
    results?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/required
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/required
     */
    required?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionEnd
     */
    selectionEnd?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionStart
     */
    selectionStart?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/size
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/size
     */
    size?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/step
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/step
     */
    step?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/type
     */
    type?:
      /** A push button with no default behavior displaying the value of the value attribute, empty by default. */
      | 'button'
      /** A check box allowing single values to be selected/deselected. */
      | 'checkbox'
      /** A control for specifying a color; opening a color picker when active in supporting browsers. */
      | 'color'
      /** A control for entering a date (year, month, and day, with no time). Opens a date picker or numeric wheels for year, month, day when active in supporting browsers. */
      | 'date'
      /** A control for entering a date and time, with no time zone. Opens a date picker or numeric wheels for date- and time-components when active in supporting browsers. */
      | 'datetime-local'
      /** A field for editing an email address. Looks like a text input, but has validation parameters and relevant keyboard in supporting browsers and devices with dynamic keyboards. */
      | 'email'
      /** A control that lets the user select a file. Use the accept attribute to define the types of files that the control can select. */
      | 'file'
      /** A control that is not displayed but whose value is submitted to the server. There is an example in the next column, but it's hidden! */
      | 'hidden'
      /** A graphical submit button. Displays an image defined by the src attribute. The alt attribute displays if the image src is missing. */
      | 'image'
      /** A control for entering a month and year, with no time zone. */
      | 'month'
      /** A control for entering a number. Displays a spinner and adds default validation. Displays a numeric keypad in some devices with dynamic keypads. */
      | 'number'
      /** A single-line text field whose value is obscured. Will alert user if site is not secure. */
      | 'password'
      /** A radio button, allowing a single value to be selected out of multiple choices with the same name value. */
      | 'radio'
      /** A control for entering a number whose exact value is not important. Displays as a range widget defaulting to the middle value. Used in conjunction min and max to define the range of acceptable values. */
      | 'range'
      /** A button that resets the contents of the form to default values. Not recommended. */
      | 'reset'
      /** A single-line text field for entering search strings. Line-breaks are automatically removed from the input value. May include a delete icon in supporting browsers that can be used to clear the field. Displays a search icon instead of enter key on some devices with dynamic keypads. */
      | 'search'
      /** A button that submits the form. */
      | 'submit'
      /** A control for entering a telephone number. Displays a telephone keypad in some devices with dynamic keypads. */
      | 'tel'
      /** The default value. A single-line text field. Line-breaks are automatically removed from the input value. */
      | 'text'
      /** A control for entering a time value with no time zone. */
      | 'time'
      /** A field for entering a URL. Looks like a text input, but has validation parameters and relevant keyboard in supporting browsers and devices with dynamic keyboards. */
      | 'url'
      /** A control for entering a date consisting of a week-year number and a week number with no time zone. */
      | 'week'
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/value
     */
    value?: string[] | string | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/valueAsDate
     */
    valueAsDate?: Date | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/valueAsNumber
     */
    valueAsNumber?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/width
     */
    width?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#webkitdirectory
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
     */
    webkitdirectory?: boolean | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/cancel_event
     */
    'on:cancel'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/invalid_event
     */
    'on:invalid'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/search_event
     */
    'on:search'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select_event
     */
    'on:select'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionchange_event
     */
    'on:selectionchange'?: EventHandler<T, Event> | null | undefined

    /**
     * Two-way binding `checked`.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#checked
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/checked
     */
    'model:checked'?: boolean | null | undefined
    /**
     * Two-way binding `value`.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/value
     */
    'model:value'?: string | null | undefined
    /**
     * Two-way binding `valueAsDate`.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/valueAsDate
     */
    'model:valueAsDate'?: Date | null | undefined
    /**
     * Two-way binding `valueAsNumber`.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/valueAsNumber
     */
    'model:valueAsNumber'?: number | null | undefined
    /** Binds a {@link FieldModelBinding}: value, change, focus, disabled, elementRef. */
    'model:field'?: FieldModelBinding
  }
  interface InsHTMLAttributes<T = HTMLElementTagNameMap['ins']>
    extends HTMLAttributes<T> {
    /**
      * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ins#cite
      * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLModElement/cite
      */
    cite?: string | null | undefined
    /**
      * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ins#datetime
      * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLModElement/dateTime
      * @alias dateTime
      */
    datetime?: string | null | undefined
  }
  /**
   * @deprecated
   */
  interface KeygenHTMLAttributes<T = HTMLElementDeprecatedTagNameMap['keygen']>
    extends HTMLAttributes<T> {
    challenge?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     */
    disabled?: boolean | null | undefined
    form?: string | null | undefined
    keytype?: string | null | undefined
    keyparams?: string | null | undefined
    name?: string | null | undefined
  }
  interface LabelHTMLAttributes<T = HTMLElementTagNameMap['label']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label#for
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/for
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/htmlFor
     * @alias htmlFor
     */
    for?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
  }
  interface LiHTMLAttributes<T = HTMLElementTagNameMap['li']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/li#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLIElement/value
     */
    value?: `${number}` | number | null | undefined
  }
  interface LinkHTMLAttributes<T = HTMLElementTagNameMap['link']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#as
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/as
     */
    as?: HTMLLinkAs | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#blocking
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/blocking
     */
    blocking?: 'render' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/crossOrigin
     * @alias crossOrigin
     */
    crossorigin?: HTMLCrossorigin | '' | boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#fetchpriority
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/fetchPriority
     * @alias fetchPriority
     */
    fetchpriority?: 'high' | 'low' | 'auto' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#href
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/href
     */
    href?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#hreflang
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/hreflang
     */
    hreflang?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#imagesizes
     */
    imagesizes?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#imagesrcset
     */
    imagesrcset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#integrity
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/integrity
     */
    integrity?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#media
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/media
     */
    media?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/rel
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/relList
     * @todo Should support for values HTMLLinkRel[]?
     */
    rel?: HTMLLinkRel | (string & {}) | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#sizes
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/sizes
     */
    sizes?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#title
     */
    title?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/type
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    type?: string | null | undefined
  }
  interface MapHTMLAttributes<T = HTMLElementTagNameMap['map']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/map#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMapElement/name
     */
    name?: string | null | undefined
  }
  interface MediaHTMLAttributes<T = HTMLElementTagNameMap['audio' | 'video']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#autoplay
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#autoplay
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/autoplay
     */
    autoplay?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#controls
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#controls
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controls
     */
    controls?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#controlslist
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#controlslist
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controlsList
     * @alias controlsList
     * @todo Should support for values ('nodownload' | 'nofullscreen' | 'noremoteplayback' | (string & {}))[]?
     */
    controlslist?:
      | 'nodownload'
      | 'nofullscreen'
      | 'noremoteplayback'
      | 'nodownload nofullscreen'
      | 'nodownload noremoteplayback'
      | 'nofullscreen noremoteplayback'
      | 'nodownload nofullscreen noremoteplayback'
      | (string & {})
      | null
      | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/crossOrigin
     * @alias crossOrigin
     */
    crossorigin?: HTMLCrossorigin | '' | boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
     */
    currentTime?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#disableremoteplayback
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#disableremoteplayback
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/disableRemotePlayback
     * @alias disableRemotePlayback
     */
    disableremoteplayback?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#loop
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#loop
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loop
     */
    loop?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/mediaGroup
     * @deprecated
     */
    mediagroup?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#muted
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#muted
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/defaultMuted
     */
    muted?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
     */
    playbackRate?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#preload
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#preload
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload
     * @todo Should support for values boolean?
     */
    preload?: '' | 'none' | 'metadata' | 'auto' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
     */
    preservesPitch?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/src#muted
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/src#muted
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject
     */
    srcObject?: MediaStream | MediaSource | Blob | File | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
     */
    volume?: `${number}` | number | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/abort_event
     */
    'on:abort'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event
     */
    'on:canplay'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplaythrough_event
     */
    'on:canplaythrough'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/durationchange_event
     */
    'on:durationchange'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/emptied_event
     */
    'on:emptied'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/encrypted_event
     */
    'on:encrypted'?: EventHandler<T, MediaEncryptedEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event
     */
    'on:ended'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error_event
     */
    'on:error'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
     */
    'on:loadeddata'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event
     */
    'on:loadedmetadata'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadstart_event
     */
    'on:loadstart'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause_event
     */
    'on:pause'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event
     */
    'on:play'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event
     */
    'on:playing'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/progress_event
     */
    'on:progress'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ratechange_event
     */
    'on:ratechange'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
     */
    'on:seeked'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking_event
     */
    'on:seeking'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event
     */
    'on:stalled'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/suspend_event
     */
    'on:suspend'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event
     */
    'on:timeupdate'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volumechange_event
     */
    'on:volumechange'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event
     */
    'on:waiting'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waitingforkey_event
     */
    'on:waitingforkey'?: EventHandler<T, Event> | null | undefined
  }
  interface MetaHTMLAttributes<T = HTMLElementTagNameMap['meta']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#charset
     */
    charset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#content
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMetaElement/content
     */
    content?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#http-equiv
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMetaElement/httpEquiv
     */
    'http-equiv'?:
      | 'content-security-policy'
      | 'content-type'
      | 'default-style'
      | 'x-ua-compatible'
      | 'refresh'
      | null
      | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#media
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMetaElement/media
     */
    media?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMetaElement/name
     */
    name?:
      | 'application-name'
      | 'author'
      | 'description'
      | 'generator'
      | 'keywords'
      | 'referrer'
      | 'theme-color'
      | 'color-scheme'
      | 'viewport'
      | 'creator'
      | 'googlebot'
      | 'publisher'
      | 'robots'
      | 'application-title'
      | (string & {})
      | null
      | undefined
  }
  interface MeterHTMLAttributes<T = HTMLElementTagNameMap['meter']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter#high
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/high
     */
    high?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter#low
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/low
     */
    low?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/max
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/max
     */
    max?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/min
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/min
     */
    min?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter#optimum
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/optimum
     */
    optimum?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meter#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMeterElement/value
     */
    value?: `${number}` | number | null | undefined
  }
  interface ObjectHTMLAttributes<T = HTMLElementTagNameMap['object']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#archive
     * @todo Should support for values string[]?
     * @deprecated
     */
    archive?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#border
     * @deprecated
     */
    border?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#classid
     * @deprecated
     */
    classid?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#codebase
     * @deprecated
     */
    codebase?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#codetype
     * @deprecated
     */
    codetype?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#data
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/data
     */
    data?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#declare
     * @deprecated
     */
    declare?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#standby
     * @deprecated
     */
    standby?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/type
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    type?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#usemap
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/useMap
     * @alias useMap
     * @deprecated
     */
    usemap?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/object#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface OlHTMLAttributes<T = HTMLElementTagNameMap['ol']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol#reversed
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOListElement/reversed
     */
    reversed?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol#start
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOListElement/start
     */
    start?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOListElement/type
     */
    type?: '1' | 'a' | 'A' | 'i' | 'I' | null | undefined
  }
  interface OptgroupHTMLAttributes<T = HTMLElementTagNameMap['optgroup']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptGroupElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup#label
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptGroupElement/label
     */
    label?: string | null | undefined
  }
  interface OptionHTMLAttributes<T = HTMLElementTagNameMap['option']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/option#label
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement/label
     */
    label?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/option#selected
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement/selected
     */
    selected?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/option#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement/value
     */
    value?: string | number | null | undefined
  }
  interface OutputHTMLAttributes<T = HTMLElementTagNameMap['output']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/output#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOutputElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/for
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOutputElement/htmlFor
     * @alias htmlFor
     * @todo Should support for values string[]?
     */
    for?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/output#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLOutputElement/name
     */
    name?: string | null | undefined
  }
  /**
   * @deprecated
   */
  interface ParamHTMLAttributes<T = HTMLElementDeprecatedTagNameMap['param']>
    extends HTMLAttributes<T> {
    name?: string
    value?: string | number
  }
  interface ProgressHTMLAttributes<T = HTMLElementTagNameMap['progress']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/max
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLProgressElement/max
     */
    max?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress#value
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLProgressElement/value
     */
    value?: `${number}` | number | null | undefined
  }
  interface QuoteHTMLAttributes<T = HTMLElementTagNameMap['q']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/q#cite
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLQuoteElement/cite
     */
    cite?: string | null | undefined
  }
  interface ScriptHTMLAttributes<T = HTMLElementTagNameMap['script']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#async
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/async
     */
    async?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#attributionsrc
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/attributionSrc
     * @alias attributionSrc
     */
    attributionsrc?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#blocking
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/blocking
     */
    blocking?: 'render' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#charset
     * @deprecated
     */
    charset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/crossOrigin
     * @alias crossOrigin
     */
    crossorigin?: HTMLCrossorigin | '' | boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#defer
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/defer
     */
    defer?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#fetchpriority
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/fetchPriority
     * @alias fetchPriority
     */
    fetchpriority?: 'high' | 'low' | 'auto' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#integrity
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/integrity
     */
    integrity?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#nomodule
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/noModule
     * @alias noModule
     */
    nomodule?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/nonce
     * @todo Should be global attribute?
     */
    nonce?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#referrerpolicy
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/referrerPolicy
     * @alias referrerPolicy
     */
    referrerpolicy?: HTMLReferrerPolicy | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#type
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/type
     */
    type?: 'importmap' | 'module' | 'speculationrules' | null | undefined
  }
  interface SelectHTMLAttributes<T = HTMLElementTagNameMap['select']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/autocomplete
     * @todo Should support for values boolean?
     */
    autocomplete?: HTMLAutocomplete | '' | 'on' | 'off' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/multiple
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/multiple
     */
    multiple?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/required
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/required
     */
    required?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedIndex
     */
    selectedIndex?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/size
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/size
     */
    size?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/value
     */
    value?: string | number | null | undefined

    /**
     * Two-way binding `value`.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/value
     */
    'model:value'?: string | null | undefined
    /** Binds a {@link FieldModelBinding}: value, change, focus, disabled, elementRef. */
    'model:field'?: FieldModelBinding
  }
  interface HTMLSlotElementAttributes<T = HTMLElementTagNameMap['slot']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/slot#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/name
     */
    name?: string | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/slotchange_event
     */
    'on:slotchange'?: EventHandler<T, Event> | null | undefined
  }
  interface SourceHTMLAttributes<T = HTMLElementTagNameMap['source']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#media
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/media
     */
    media?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#sizes
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/sizes
     */
    sizes?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#srcset
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/srcset
     */
    srcset?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/type
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
    type?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement/width
     */
    width?: `${number}` | number | null | undefined
  }
  interface StyleHTMLAttributes<T = HTMLElementTagNameMap['style']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style#blocking
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLStyleElement/blocking
     */
    blocking?: 'render' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLStyleElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style#media
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLStyleElement/media
     */
    media?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/nonce
     * @todo Should be global attribute?
     */
    nonce?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style#type
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLStyleElement/type
     * @deprecated
     */
    type?: 'text/css' | null | undefined
  }
  interface TableHTMLAttributes<T = HTMLElementTagNameMap['table']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#align
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/align
     * @deprecated
     */
    align?: 'left' | 'center' | 'right' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/bgColor
     * @alias bgColor
     * @deprecated
     */
    bgcolor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#border
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/border
     * @deprecated
     */
    border?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#cellpadding
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/cellPadding
     * @alias cellPadding
     * @deprecated
     */
    cellpadding?: `${number}%` | `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#cellspacing
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/cellSpacing
     * @alias cellSpacing
     * @deprecated
     */
    cellspacing?: `${number}%` | `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#frame
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/frame
     * @deprecated
     */
    frame?: 'void' | 'above' | 'below' | 'hsides' | 'vsides' | 'lhs' | 'rhs' | 'box' | 'border' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#rules
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/rules
     * @deprecated
     */
    rules?: 'none' | 'groups' | 'rows' | 'cols' | 'all' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#summary
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/summary
     * @deprecated
     */
    summary?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableElement/width
     * @deprecated
     */
    width?: `${number}%` | `${number}` | number | null | undefined
  }
  interface TableSectionHTMLAttributes<T = HTMLElementTagNameMap['thead' | 'tbody' | 'tfoot']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead#align
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody#align
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot#align
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableSectionElement/align
     * @deprecated
     */
    align?: 'left' | 'center' | 'right' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableSectionElement/bgColor
     * @alias bgColor
     * @deprecated
     */
    bgcolor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead#charn
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody#charn
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot#char
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableSectionElement/ch
     * @alias ch
     * @deprecated
     */
    char?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableSectionElement/chOff
     * @alias chOff
     * @deprecated
     */
    charoff?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/thead#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tbody#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tfoot#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableSectionElement/vAlign
     * @alias vAlign
     * @deprecated
     */
    valign?: 'top' | 'center' | 'middle' | 'bottom' | 'baseline' | null | undefined
  }
  interface TableCellHTMLAttributes<T = HTMLElementTagNameMap['td' | 'th']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#abbr
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#abbr
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/abbr
     * @deprecated
     */
    abbr?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#align
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#align
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/align
     * @deprecated
     */
    align?: 'left' | 'center' | 'right' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#axis
     * @todo Should support for values string[]?
     * @deprecated
     */
    axis?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/bgColor
     * @alias bgColor
     * @deprecated
     */
    bgcolor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#charn
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#charn
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/ch
     * @alias ch
     * @deprecated
     */
    char?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/chOff
     * @alias chOff
     * @deprecated
     */
    charoff?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#colspan
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#colspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/colSpan
     * @alias colSpan
     */
    colspan?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#headers
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#headers
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/headers
     * @todo Should support for values string[]?
     */
    headers?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#height
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/height
     * @deprecated
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/noWrap
     * @deprecated
     */
    noWrap?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#scope
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#scope
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/scope
     * @deprecated
     */
    scope?: 'col' | 'colgroup' | 'row' | 'rowgroup' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#rowspan
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#rowspan
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/rowSpan
     * @alias rowSpan
     */
    rowspan?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/vAlign
     * @alias vAlign
     * @deprecated
     */
    valign?: 'top' | 'center' | 'middle' | 'bottom' | 'baseline' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/td#width
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/th#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableCellElement/width
     * @deprecated
     */
    width?: `${number}` | number | null | undefined
  }
  interface TableColHTMLAttributes<T = HTMLElementTagNameMap['col' | 'colgroup']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/col#span
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/colgroup#span
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableColElement/span
     */
    span?: `${number}` | number | null | undefined
  }
  interface TableRowHTMLAttributes<T = HTMLElementTagNameMap['tr']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr#align
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TableRowHTMLAttributes/align
     * @deprecated
     */
    align?: 'left' | 'center' | 'right' | 'justify' | 'char' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr#bgcolor
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TableRowHTMLAttributes/bgColor
     * @alias bgColor
     * @deprecated
     */
    bgcolor?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr#charn
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TableRowHTMLAttributes/ch
     * @alias ch
     * @deprecated
     */
    char?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr#charoff
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TableRowHTMLAttributes/chOff
     * @alias chOff
     * @deprecated
     */
    charoff?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/tr#valign
     * @see https://developer.mozilla.org/en-US/docs/Web/API/TableRowHTMLAttributes/vAlign
     * @alias vAlign
     * @deprecated
     */
    valign?: 'top' | 'center' | 'middle' | 'bottom' | 'baseline' | null | undefined
  }
  interface TemplateHTMLAttributes<T extends HTMLTemplateElement>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/content
     */
    content?: DocumentFragment | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#shadowrootclonable
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootClonable
     * @alias shadowRootClonable
     */
    shadowrootclonable?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#shadowrootdelegatesfocus
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootDelegatesFocus
     * @alias shadowRootDelegatesFocus
     */
    shadowrootdelegatesfocus?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#shadowrootmode
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootMode
     * @alias shadowRootMode
     */
    shadowrootmode?: 'open' | 'closed' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#shadowrootserializable
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootSerializable
     * @alias shadowRootSerializable
     */
    shadowrootserializable?: boolean | null | undefined
  }
  interface TextareaHTMLAttributes<T = HTMLElementTagNameMap['textarea']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/autocomplete
     * @todo Should support for values boolean?
     */
    autocomplete?: HTMLAutocomplete | '' | 'on' | 'off' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea#cols
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/cols
     */
    cols?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/dirname
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/dirName
     * @alias dirName
     */
    dirname?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/disabled
     */
    disabled?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea#form
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/form
     * @todo Should support for values HTMLFormElement?
     */
    form?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/maxlength
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/maxLength
     * @alias maxLength
     */
    maxlength?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/minlength
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/minlength
     * @alias minLength
     */
    minlength?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea#name
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/name
     */
    name?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/placeholder
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/placeholder
     */
    placeholder?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/readonly
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/readOnly
     * @alias readOnly
     */
    readonly?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/required
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/required
     */
    required?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea#rows
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/rows
     */
    rows?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionEnd
     */
    selectionEnd?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionStart
     */
    selectionStart?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/value
     */
    value?: string | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea#wrap
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/wrap
     */
    wrap?: 'hard' | 'soft' | 'off' | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/select_event
     */
    'on:select'?: EventHandler<T, Event> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/selectionchange_event
     */
    'on:selectionchange'?: EventHandler<T, Event> | null | undefined

    /**
     * Two-way binding `value`.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/value
     */
    'model:value'?: string | null | undefined
    /** Binds a {@link FieldModelBinding}: value, change, focus, disabled, elementRef. */
    'model:field'?: FieldModelBinding
  }
  interface TimeHTMLAttributes<T = HTMLElementTagNameMap['time']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time#datetime
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTimeElement/dateTime
     * @alias dateTime
     */
    datetime?: string | null | undefined
  }
  interface TrackHTMLAttributes<T = HTMLElementTagNameMap['track']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track#default
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/default
     */
    default?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track#kind
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/kind
     */
    kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata' | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track#label
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/label
     */
    label?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track#src
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/src
     */
    src?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track#srclang
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/srclang
     */
    srclang?: string | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/cuechange_event
     */
    'on:cuechange'?: EventHandler<T, Event> | null | undefined
  }
  interface UlHTMLAttributes<T = HTMLElementTagNameMap['ul']>
    extends HTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ul#compact
     * @deprecated
     */
    compact?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ul#type
     * @deprecated
     */
    type?: 'circle' | 'disc' | 'square' | 'triangle' | null | undefined
  }
  interface VideoHTMLAttributes<T> extends MediaHTMLAttributes<T> {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#disablepictureinpicture
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/disablePictureInPicture
     * @alias disablePictureInPicture
     */
    disablepictureinpicture?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#height
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/height
     */
    height?: `${number}` | number | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#playsinline
     * @alias playsInline
     */
    playsinline?: boolean | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#poster
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/poster
     */
    poster?: string | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#width
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/width
     */
    width?: `${number}` | number | null | undefined

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/enterpictureinpicture_event
     */
    'on:enterpictureinpicture'?: EventHandler<T, PictureInPictureEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/leavepictureinpicture_event
     */
    'on:leavepictureinpicture'?: EventHandler<T, PictureInPictureEvent> | null | undefined
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/resize_event
     */
    'on:resize'?: EventHandler<T, Event> | null | undefined
  }

  // #region SVG

  type SVGPreserveAspectRatio =
    | 'none'
    | 'xMinYMin'
    | 'xMidYMin'
    | 'xMaxYMin'
    | 'xMinYMid'
    | 'xMidYMid'
    | 'xMaxYMid'
    | 'xMinYMax'
    | 'xMidYMax'
    | 'xMaxYMax'
    | 'xMinYMin meet'
    | 'xMidYMin meet'
    | 'xMaxYMin meet'
    | 'xMinYMid meet'
    | 'xMidYMid meet'
    | 'xMaxYMid meet'
    | 'xMinYMax meet'
    | 'xMidYMax meet'
    | 'xMaxYMax meet'
    | 'xMinYMin slice'
    | 'xMidYMin slice'
    | 'xMaxYMin slice'
    | 'xMinYMid slice'
    | 'xMidYMid slice'
    | 'xMaxYMid slice'
    | 'xMinYMax slice'
    | 'xMidYMax slice'
    | 'xMaxYMax slice'
  type ImagePreserveAspectRatio =
    | SVGPreserveAspectRatio
    | 'defer none'
    | 'defer xMinYMin'
    | 'defer xMidYMin'
    | 'defer xMaxYMin'
    | 'defer xMinYMid'
    | 'defer xMidYMid'
    | 'defer xMaxYMid'
    | 'defer xMinYMax'
    | 'defer xMidYMax'
    | 'defer xMaxYMax'
    | 'defer xMinYMin meet'
    | 'defer xMidYMin meet'
    | 'defer xMaxYMin meet'
    | 'defer xMinYMid meet'
    | 'defer xMidYMid meet'
    | 'defer xMaxYMid meet'
    | 'defer xMinYMax meet'
    | 'defer xMidYMax meet'
    | 'defer xMaxYMax meet'
    | 'defer xMinYMin slice'
    | 'defer xMidYMin slice'
    | 'defer xMaxYMin slice'
    | 'defer xMinYMid slice'
    | 'defer xMidYMid slice'
    | 'defer xMaxYMid slice'
    | 'defer xMinYMax slice'
    | 'defer xMidYMax slice'
    | 'defer xMaxYMax slice'
  type SVGUnits = 'userSpaceOnUse' | 'objectBoundingBox'
  interface CoreSVGAttributes<T>
    extends AriaAttributes,
      DOMAttributes<T>,
      StylePropertyAttributes {
    id?: string
    lang?: string
    tabindex?: `${number}` | number | null | undefined
  }
  interface StylableSVGAttributes extends CssAttributes {
    /**
     * @alias className
     */
    class?: ClassNameValue
    /**
     * @alias class
     */
    className?: ClassNameValue
    style?: CSSProperties | string
  }
  interface TransformableSVGAttributes {
    transform?: string
  }
  interface ConditionalProcessingSVGAttributes {
    requiredExtensions?: string
    requiredFeatures?: string
    systemLanguage?: string
  }
  interface ExternalResourceSVGAttributes {
    externalResourcesRequired?: 'true' | 'false'
  }
  interface AnimationTimingSVGAttributes {
    begin?: string
    dur?: string
    end?: string
    min?: string
    max?: string
    restart?: 'always' | 'whenNotActive' | 'never'
    repeatCount?: number | 'indefinite'
    repeatDur?: string
    fill?: 'freeze' | 'remove'
  }
  interface AnimationValueSVGAttributes {
    calcMode?: 'discrete' | 'linear' | 'paced' | 'spline'
    values?: string
    keyTimes?: string
    keySplines?: string
    from?: `${number}` | number | null | undefined
    to?: `${number}` | number | null | undefined
    by?: `${number}` | number | null | undefined
  }
  interface AnimationAdditionSVGAttributes {
    attributeName?: string
    additive?: 'replace' | 'sum'
    accumulate?: 'none' | 'sum'
  }
  interface AnimationAttributeTargetSVGAttributes {
    attributeName?: string
    attributeType?: 'CSS' | 'XML' | 'auto'
  }
  interface PresentationSVGAttributes {
    'alignment-baseline'?:
      | 'auto'
      | 'baseline'
      | 'before-edge'
      | 'text-before-edge'
      | 'middle'
      | 'central'
      | 'after-edge'
      | 'text-after-edge'
      | 'ideographic'
      | 'alphabetic'
      | 'hanging'
      | 'mathematical'
      | 'inherit'
    'baseline-shift'?: `${number}` | number | null | undefined
    clip?: string
    'clip-path'?: string
    'clip-rule'?: 'nonzero' | 'evenodd' | 'inherit'
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/color
     */
    color?: string | null | undefined
    'color-interpolation'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit'
    'color-interpolation-filters'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit'
    'color-profile'?: string
    'color-rendering'?: 'auto' | 'optimizeSpeed' | 'optimizeQuality' | 'inherit'
    cursor?: string
    direction?: 'ltr' | 'rtl' | 'inherit'
    display?: string
    'dominant-baseline'?:
      | 'auto'
      | 'text-bottom'
      | 'alphabetic'
      | 'ideographic'
      | 'middle'
      | 'central'
      | 'mathematical'
      | 'hanging'
      | 'text-top'
      | 'inherit'
    'enable-background'?: string
    fill?: string
    'fill-opacity'?: 'inherit' | `${number}` | number | null | undefined
    'fill-rule'?: 'nonzero' | 'evenodd' | 'inherit'
    filter?: string
    'flood-color'?: string
    'flood-opacity'?: 'inherit' | `${number}` | number | null | undefined
    'font-family'?: string
    'font-size'?: string
    'font-size-adjust'?: `${number}` | number | null | undefined
    'font-stretch'?: string
    'font-style'?: 'normal' | 'italic' | 'oblique' | 'inherit'
    'font-variant'?: string
    'font-weight'?: `${number}` | number | null | undefined
    'glyph-orientation-horizontal'?: string
    'glyph-orientation-vertical'?: string
    'image-rendering'?: 'auto' | 'optimizeQuality' | 'optimizeSpeed' | 'inherit'
    kerning?: string
    'letter-spacing'?: `${number}` | number | null | undefined
    'lighting-color'?: string
    'marker-end'?: string
    'marker-mid'?: string
    'marker-start'?: string
    mask?: string
    opacity?: 'inherit' | `${number}` | number | null | undefined
    overflow?: 'visible' | 'hidden' | 'scroll' | 'auto' | 'inherit'
    pathLength?: `${number}` | number | null | undefined
    'pointer-events'?:
      | 'bounding-box'
      | 'visiblePainted'
      | 'visibleFill'
      | 'visibleStroke'
      | 'visible'
      | 'painted'
      | 'color'
      | 'fill'
      | 'stroke'
      | 'all'
      | 'none'
      | 'inherit'
    'shape-rendering'?:
      | 'auto'
      | 'optimizeSpeed'
      | 'crispEdges'
      | 'geometricPrecision'
      | 'inherit'
    'stop-color'?: string
    'stop-opacity'?: 'inherit' | `${number}` | number | null | undefined
    stroke?: string
    'stroke-dasharray'?: string
    'stroke-dashoffset'?: `${number}` | number | null | undefined
    'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit'
    'stroke-linejoin'?:
      | 'arcs'
      | 'bevel'
      | 'miter'
      | 'miter-clip'
      | 'round'
      | 'inherit'
    'stroke-miterlimit'?: 'inherit' | `${number}` | number | null | undefined
    'stroke-opacity'?: 'inherit' | `${number}` | number | null | undefined
    'stroke-width'?: `${number}` | number | null | undefined
    'text-anchor'?: 'start' | 'middle' | 'end' | 'inherit'
    'text-decoration'?:
      | 'none'
      | 'underline'
      | 'overline'
      | 'line-through'
      | 'blink'
      | 'inherit'
    'text-rendering'?:
      | 'auto'
      | 'optimizeSpeed'
      | 'optimizeLegibility'
      | 'geometricPrecision'
      | 'inherit'
    'unicode-bidi'?: string
    visibility?: 'visible' | 'hidden' | 'collapse' | 'inherit'
    'word-spacing'?: `${number}` | number | null | undefined
    'writing-mode'?:
      | 'lr-tb'
      | 'rl-tb'
      | 'tb-rl'
      | 'lr'
      | 'rl'
      | 'tb'
      | 'inherit'
  }
  interface AnimationElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      ConditionalProcessingSVGAttributes {}
  interface ContainerElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      Pick<
        PresentationSVGAttributes,
        | 'clip-path'
        | 'mask'
        | 'cursor'
        | 'opacity'
        | 'filter'
        | 'enable-background'
        | 'color-interpolation'
        | 'color-rendering'
      > {}
  interface FilterPrimitiveElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      Pick<PresentationSVGAttributes, 'color-interpolation-filters'> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    result?: string
  }
  interface SingleInputFilterSVGAttributes {
    in?: string
  }
  interface DoubleInputFilterSVGAttributes {
    in?: string
    in2?: string
  }
  interface FitToViewBoxSVGAttributes {
    viewBox?: string
    preserveAspectRatio?: SVGPreserveAspectRatio
  }
  interface GradientElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    gradientUnits?: SVGUnits
    gradientTransform?: string
    spreadMethod?: 'pad' | 'reflect' | 'repeat'
    href?: string
  }
  interface GraphicsElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      Pick<
        PresentationSVGAttributes,
        | 'clip-rule'
        | 'mask'
        | 'pointer-events'
        | 'cursor'
        | 'opacity'
        | 'filter'
        | 'display'
        | 'visibility'
        | 'color-interpolation'
        | 'color-rendering'
      > {}
  interface LightSourceElementSVGAttributes<T> extends CoreSVGAttributes<T> {}
  interface NewViewportSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      Pick<PresentationSVGAttributes, 'overflow' | 'clip'> {
    viewBox?: string
  }
  interface ShapeElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      Pick<
        PresentationSVGAttributes,
        | 'color'
        | 'fill'
        | 'fill-rule'
        | 'fill-opacity'
        | 'stroke'
        | 'stroke-width'
        | 'stroke-linecap'
        | 'stroke-linejoin'
        | 'stroke-miterlimit'
        | 'stroke-dasharray'
        | 'stroke-dashoffset'
        | 'stroke-opacity'
        | 'shape-rendering'
        | 'pathLength'
      > {}
  interface TextContentElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      Pick<
        PresentationSVGAttributes,
        | 'font-family'
        | 'font-style'
        | 'font-variant'
        | 'font-weight'
        | 'font-stretch'
        | 'font-size'
        | 'font-size-adjust'
        | 'kerning'
        | 'letter-spacing'
        | 'word-spacing'
        | 'text-decoration'
        | 'glyph-orientation-horizontal'
        | 'glyph-orientation-vertical'
        | 'direction'
        | 'unicode-bidi'
        | 'text-anchor'
        | 'dominant-baseline'
        | 'color'
        | 'fill'
        | 'fill-rule'
        | 'fill-opacity'
        | 'stroke'
        | 'stroke-width'
        | 'stroke-linecap'
        | 'stroke-linejoin'
        | 'stroke-miterlimit'
        | 'stroke-dasharray'
        | 'stroke-dashoffset'
        | 'stroke-opacity'
      > {}
  interface ZoomAndPanSVGAttributes {
    zoomAndPan?: 'disable' | 'magnify'
  }
  interface AnimateSVGAttributes<T>
    extends AnimationElementSVGAttributes<T>,
      AnimationAttributeTargetSVGAttributes,
      AnimationTimingSVGAttributes,
      AnimationValueSVGAttributes,
      AnimationAdditionSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'color-interpolation' | 'color-rendering'
      > {}
  interface AnimateMotionSVGAttributes<T>
    extends AnimationElementSVGAttributes<T>,
      AnimationTimingSVGAttributes,
      AnimationValueSVGAttributes,
      AnimationAdditionSVGAttributes {
    path?: string
    keyPoints?: string
    rotate?: 'auto' | 'auto-reverse' | `${number}` | number | null | undefined
    origin?: 'default'
  }
  interface AnimateTransformSVGAttributes<T>
    extends AnimationElementSVGAttributes<T>,
      AnimationAttributeTargetSVGAttributes,
      AnimationTimingSVGAttributes,
      AnimationValueSVGAttributes,
      AnimationAdditionSVGAttributes {
    type?: 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY'
  }
  interface CircleSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    cx?: `${number}` | number | null | undefined
    cy?: `${number}` | number | null | undefined
    r?: `${number}` | number | null | undefined
  }
  interface ClipPathSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'clip-path'> {
    clipPathUnits?: SVGUnits
  }
  interface DefsSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {}
  interface DescSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      StylableSVGAttributes {}
  interface EllipseSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    cx?: `${number}` | number | null | undefined
    cy?: `${number}` | number | null | undefined
    rx?: `${number}` | number | null | undefined
    ry?: `${number}` | number | null | undefined
  }
  interface FeBlendSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    mode?: 'normal' | 'multiply' | 'screen' | 'darken' | 'lighten'
  }
  interface FeColorMatrixSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    type?: 'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha'
    values?: string
  }
  interface FeComponentTransferSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {}
  interface FeCompositeSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    operator?: 'over' | 'in' | 'out' | 'atop' | 'xor' | 'arithmetic'
    k1?: `${number}` | number | null | undefined
    k2?: `${number}` | number | null | undefined
    k3?: `${number}` | number | null | undefined
    k4?: `${number}` | number | null | undefined
  }
  interface FeConvolveMatrixSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    order?: `${number}` | number | null | undefined
    kernelMatrix?: string
    divisor?: `${number}` | number | null | undefined
    bias?: `${number}` | number | null | undefined
    targetX?: `${number}` | number | null | undefined
    targetY?: `${number}` | number | null | undefined
    edgeMode?: 'duplicate' | 'wrap' | 'none'
    kernelUnitLength?: `${number}` | number | null | undefined
    preserveAlpha?: 'true' | 'false'
  }
  interface FeDiffuseLightingSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'lighting-color'> {
    surfaceScale?: `${number}` | number | null | undefined
    diffuseConstant?: `${number}` | number | null | undefined
    kernelUnitLength?: `${number}` | number | null | undefined
  }
  interface FeDisplacementMapSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    scale?: `${number}` | number | null | undefined
    xChannelSelector?: 'R' | 'G' | 'B' | 'A'
    yChannelSelector?: 'R' | 'G' | 'B' | 'A'
  }
  interface FeDistantLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    azimuth?: `${number}` | number | null | undefined
    elevation?: `${number}` | number | null | undefined
  }
  interface FeDropShadowSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      FilterPrimitiveElementSVGAttributes<T>,
      StylableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'color' | 'flood-color' | 'flood-opacity'
      > {
    dx?: `${number}` | number | null | undefined
    dy?: `${number}` | number | null | undefined
    stdDeviation?: `${number}` | number | null | undefined
  }
  interface FeFloodSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      StylableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'color' | 'flood-color' | 'flood-opacity'
      > {}
  interface FeFuncSVGAttributes<T> extends CoreSVGAttributes<T> {
    type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma'
    tableValues?: string
    slope?: `${number}` | number | null | undefined
    intercept?: `${number}` | number | null | undefined
    amplitude?: `${number}` | number | null | undefined
    exponent?: `${number}` | number | null | undefined
    offset?: `${number}` | number | null | undefined
  }
  interface FeGaussianBlurSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    stdDeviation?: `${number}` | number | null | undefined
  }
  interface FeImageSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    preserveAspectRatio?: SVGPreserveAspectRatio
    href?: string
  }
  interface FeMergeSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      StylableSVGAttributes {}
  interface FeMergeNodeSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      SingleInputFilterSVGAttributes {}
  interface FeMorphologySVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    operator?: 'erode' | 'dilate'
    radius?: `${number}` | number | null | undefined
  }
  interface FeOffsetSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    dx?: `${number}` | number | null | undefined
    dy?: `${number}` | number | null | undefined
  }
  interface FePointLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    z?: `${number}` | number | null | undefined
  }
  interface FeSpecularLightingSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'lighting-color'> {
    surfaceScale?: string
    specularConstant?: string
    specularExponent?: string
    kernelUnitLength?: `${number}` | number | null | undefined
  }
  interface FeSpotLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    z?: `${number}` | number | null | undefined
    pointsAtX?: `${number}` | number | null | undefined
    pointsAtY?: `${number}` | number | null | undefined
    pointsAtZ?: `${number}` | number | null | undefined
    specularExponent?: `${number}` | number | null | undefined
    limitingConeAngle?: `${number}` | number | null | undefined
  }
  interface FeTileSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {}
  interface FeTurbulanceSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      StylableSVGAttributes {
    baseFrequency?: `${number}` | number | null | undefined
    numOctaves?: `${number}` | number | null | undefined
    seed?: `${number}` | number | null | undefined
    stitchTiles?: 'stitch' | 'noStitch'
    type?: 'fractalNoise' | 'turbulence'
  }
  interface FilterSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    filterUnits?: SVGUnits
    primitiveUnits?: SVGUnits
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    filterRes?: `${number}` | number | null | undefined
  }
  interface ForeignObjectSVGAttributes<T>
    extends NewViewportSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'display' | 'visibility'> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
  }
  interface GSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'display' | 'visibility'> {}
  interface ImageSVGAttributes<T>
    extends NewViewportSVGAttributes<T>,
      GraphicsElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color-profile' | 'image-rendering'> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    preserveAspectRatio?: ImagePreserveAspectRatio
    href?: string
  }
  interface LineSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'marker-start' | 'marker-mid' | 'marker-end'
      > {
    x1?: `${number}` | number | null | undefined
    y1?: `${number}` | number | null | undefined
    x2?: `${number}` | number | null | undefined
    y2?: `${number}` | number | null | undefined
  }
  interface LinearGradientSVGAttributes<T>
    extends GradientElementSVGAttributes<T> {
    x1?: `${number}` | number | null | undefined
    x2?: `${number}` | number | null | undefined
    y1?: `${number}` | number | null | undefined
    y2?: `${number}` | number | null | undefined
  }
  interface MarkerSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes,
      Pick<PresentationSVGAttributes, 'overflow' | 'clip'> {
    markerUnits?: 'strokeWidth' | 'userSpaceOnUse'
    refX?: `${number}` | number | null | undefined
    refY?: `${number}` | number | null | undefined
    markerWidth?: `${number}` | number | null | undefined
    markerHeight?: `${number}` | number | null | undefined
    orient?: string
  }
  interface MaskSVGAttributes<T>
    extends Omit<ContainerElementSVGAttributes<T>, 'opacity' | 'filter'>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    maskUnits?: SVGUnits
    maskContentUnits?: SVGUnits
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
  }
  interface MetadataSVGAttributes<T> extends CoreSVGAttributes<T> {}
  interface MPathSVGAttributes<T> extends CoreSVGAttributes<T> {}
  interface PathSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'marker-start' | 'marker-mid' | 'marker-end'
      > {
    d?: string
  }
  interface PatternSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes,
      Pick<PresentationSVGAttributes, 'overflow' | 'clip'> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    patternUnits?: SVGUnits
    patternContentUnits?: SVGUnits
    patternTransform?: string
    href?: string
  }
  interface PolygonSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'marker-start' | 'marker-mid' | 'marker-end'
      > {
    points?: string
  }
  interface PolylineSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'marker-start' | 'marker-mid' | 'marker-end'
      > {
    points?: string
  }
  interface RadialGradientSVGAttributes<T>
    extends GradientElementSVGAttributes<T> {
    cx?: `${number}` | number | null | undefined
    cy?: `${number}` | number | null | undefined
    r?: `${number}` | number | null | undefined
    fx?: `${number}` | number | null | undefined
    fy?: `${number}` | number | null | undefined
  }
  interface RectSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    rx?: `${number}` | number | null | undefined
    ry?: `${number}` | number | null | undefined
  }
  interface SetSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      StylableSVGAttributes,
      AnimationTimingSVGAttributes {}
  interface StopSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'stop-color' | 'stop-opacity'> {
    offset?: `${number}` | number | null | undefined
  }
  interface SvgSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      NewViewportSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes,
      ZoomAndPanSVGAttributes,
      PresentationSVGAttributes {
    version?: string
    baseProfile?: string
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    contentScriptType?: string
    contentStyleType?: string
    xmlns?: string
  }
  interface SwitchSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'display' | 'visibility'> {}
  interface SymbolSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      NewViewportSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    preserveAspectRatio?: SVGPreserveAspectRatio
    refX?: `${number}` | number | null | undefined
    refY?: `${number}` | number | null | undefined
    viewBox?: string
  }
  interface TextSVGAttributes<T>
    extends TextContentElementSVGAttributes<T>,
      GraphicsElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'writing-mode' | 'text-rendering'> {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    dx?: `${number}` | number | null | undefined
    dy?: `${number}` | number | null | undefined
    rotate?: `${number}` | number | null | undefined
    textLength?: `${number}` | number | null | undefined
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs'
  }
  interface TextPathSVGAttributes<T>
    extends TextContentElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'alignment-baseline' | 'baseline-shift' | 'display' | 'visibility'
      > {
    startOffset?: `${number}` | number | null | undefined
    method?: 'align' | 'stretch'
    spacing?: 'auto' | 'exact'
    href?: string
  }
  interface TSpanSVGAttributes<T>
    extends TextContentElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      Pick<
        PresentationSVGAttributes,
        'alignment-baseline' | 'baseline-shift' | 'display' | 'visibility'
      > {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    dx?: `${number}` | number | null | undefined
    dy?: `${number}` | number | null | undefined
    rotate?: `${number}` | number | null | undefined
    textLength?: `${number}` | number | null | undefined
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs'
  }
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use
   */
  interface UseSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      StylableSVGAttributes,
      ConditionalProcessingSVGAttributes,
      GraphicsElementSVGAttributes<T>,
      PresentationSVGAttributes,
      ExternalResourceSVGAttributes,
      TransformableSVGAttributes {
    x?: `${number}` | number | null | undefined
    y?: `${number}` | number | null | undefined
    width?: `${number}` | number | null | undefined
    height?: `${number}` | number | null | undefined
    href?: string
  }
  interface ViewSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      FitToViewBoxSVGAttributes,
      ZoomAndPanSVGAttributes {
    viewTarget?: string
  }

  /**
   * @type {SVGElementTagNameMap}
   */
  interface SVGElementTags {
    'svg:animate': AnimateSVGAttributes<SVGAnimateElement>
    'svg:animateMotion': AnimateMotionSVGAttributes<SVGAnimateMotionElement>
    'svg:animateTransform': AnimateTransformSVGAttributes<SVGAnimateTransformElement>
    'svg:circle': CircleSVGAttributes<SVGCircleElement>
    'svg:clipPath': ClipPathSVGAttributes<SVGClipPathElement>
    'svg:defs': DefsSVGAttributes<SVGDefsElement>
    'svg:desc': DescSVGAttributes<SVGDescElement>
    'svg:ellipse': EllipseSVGAttributes<SVGEllipseElement>
    'svg:feBlend': FeBlendSVGAttributes<SVGFEBlendElement>
    'svg:feColorMatrix': FeColorMatrixSVGAttributes<SVGFEColorMatrixElement>
    'svg:feComponentTransfer': FeComponentTransferSVGAttributes<SVGFEComponentTransferElement>
    'svg:feComposite': FeCompositeSVGAttributes<SVGFECompositeElement>
    'svg:feConvolveMatrix': FeConvolveMatrixSVGAttributes<SVGFEConvolveMatrixElement>
    'svg:feDiffuseLighting': FeDiffuseLightingSVGAttributes<SVGFEDiffuseLightingElement>
    'svg:feDisplacementMap': FeDisplacementMapSVGAttributes<SVGFEDisplacementMapElement>
    'svg:feDistantLight': FeDistantLightSVGAttributes<SVGFEDistantLightElement>
    'svg:feDropShadow': FeDropShadowSVGAttributes<SVGFEDropShadowElement>
    'svg:feFlood': FeFloodSVGAttributes<SVGFEFloodElement>
    'svg:feFuncA': FeFuncSVGAttributes<SVGFEFuncAElement>
    'svg:feFuncB': FeFuncSVGAttributes<SVGFEFuncBElement>
    'svg:feFuncG': FeFuncSVGAttributes<SVGFEFuncGElement>
    'svg:feFuncR': FeFuncSVGAttributes<SVGFEFuncRElement>
    'svg:feGaussianBlur': FeGaussianBlurSVGAttributes<SVGFEGaussianBlurElement>
    'svg:feImage': FeImageSVGAttributes<SVGFEImageElement>
    'svg:feMerge': FeMergeSVGAttributes<SVGFEMergeElement>
    'svg:feMergeNode': FeMergeNodeSVGAttributes<SVGFEMergeNodeElement>
    'svg:feMorphology': FeMorphologySVGAttributes<SVGFEMorphologyElement>
    'svg:feOffset': FeOffsetSVGAttributes<SVGFEOffsetElement>
    'svg:fePointLight': FePointLightSVGAttributes<SVGFEPointLightElement>
    'svg:feSpecularLighting': FeSpecularLightingSVGAttributes<SVGFESpecularLightingElement>
    'svg:feSpotLight': FeSpotLightSVGAttributes<SVGFESpotLightElement>
    'svg:feTile': FeTileSVGAttributes<SVGFETileElement>
    'svg:feTurbulence': FeTurbulanceSVGAttributes<SVGFETurbulenceElement>
    'svg:filter': FilterSVGAttributes<SVGFilterElement>
    'svg:foreignObject': ForeignObjectSVGAttributes<SVGForeignObjectElement>
    'svg:g': GSVGAttributes<SVGGElement>
    'svg:image': ImageSVGAttributes<SVGImageElement>
    'svg:line': LineSVGAttributes<SVGLineElement>
    'svg:linearGradient': LinearGradientSVGAttributes<SVGLinearGradientElement>
    'svg:marker': MarkerSVGAttributes<SVGMarkerElement>
    'svg:mask': MaskSVGAttributes<SVGMaskElement>
    'svg:metadata': MetadataSVGAttributes<SVGMetadataElement>
    'svg:mpath': MPathSVGAttributes<SVGMPathElement>
    'svg:path': PathSVGAttributes<SVGPathElement>
    'svg:pattern': PatternSVGAttributes<SVGPatternElement>
    'svg:polygon': PolygonSVGAttributes<SVGPolygonElement>
    'svg:polyline': PolylineSVGAttributes<SVGPolylineElement>
    'svg:radialGradient': RadialGradientSVGAttributes<SVGRadialGradientElement>
    'svg:rect': RectSVGAttributes<SVGRectElement>
    'svg:set': SetSVGAttributes<SVGSetElement>
    'svg:stop': StopSVGAttributes<SVGStopElement>
    'svg:svg': SvgSVGAttributes<SVGSVGElement>
    'svg:switch': SwitchSVGAttributes<SVGSwitchElement>
    'svg:symbol': SymbolSVGAttributes<SVGSymbolElement>
    'svg:text': TextSVGAttributes<SVGTextElement>
    'svg:textPath': TextPathSVGAttributes<SVGTextPathElement>
    'svg:tspan': TSpanSVGAttributes<SVGTSpanElement>
    'svg:use': UseSVGAttributes<SVGUseElement>
    'svg:view': ViewSVGAttributes<SVGViewElement>
  }

  // #endregion

  /**
   * @type {HTMLElementTagNameMap}
   */
  interface HTMLElementTags {
    a: AnchorHTMLAttributes<HTMLElementTagNameMap['a']>
    abbr: HTMLAttributes<HTMLElementTagNameMap['abbr']>
    address: HTMLAttributes<HTMLElementTagNameMap['address']>
    area: AreaHTMLAttributes<HTMLElementTagNameMap['area']>
    article: HTMLAttributes<HTMLElementTagNameMap['article']>
    aside: HTMLAttributes<HTMLElementTagNameMap['aside']>
    audio: AudioHTMLAttributes<HTMLElementTagNameMap['audio']>
    b: HTMLAttributes<HTMLElementTagNameMap['b']>
    base: BaseHTMLAttributes<HTMLElementTagNameMap['base']>
    bdi: HTMLAttributes<HTMLElementTagNameMap['bdi']>
    bdo: HTMLAttributes<HTMLElementTagNameMap['bdo']>
    blockquote: BlockquoteHTMLAttributes<HTMLElementTagNameMap['blockquote']>
    body: HTMLAttributes<HTMLElementTagNameMap['body']>
    br: HTMLAttributes<HTMLElementTagNameMap['br']>
    button: ButtonHTMLAttributes<HTMLElementTagNameMap['button']>
    canvas: CanvasHTMLAttributes<HTMLElementTagNameMap['canvas']>
    caption: HTMLAttributes<HTMLElementTagNameMap['caption']>
    cite: HTMLAttributes<HTMLElementTagNameMap['cite']>
    code: HTMLAttributes<HTMLElementTagNameMap['code']>
    col: TableColHTMLAttributes<HTMLElementTagNameMap['col']>
    colgroup: TableColHTMLAttributes<HTMLElementTagNameMap['colgroup']>
    data: DataHTMLAttributes<HTMLElementTagNameMap['data']>
    datalist: HTMLAttributes<HTMLElementTagNameMap['datalist']>
    dd: HTMLAttributes<HTMLElementTagNameMap['dd']>
    del: HTMLAttributes<HTMLElementTagNameMap['del']>
    details: DetailsHtmlAttributes<HTMLElementTagNameMap['details']>
    dfn: HTMLAttributes<HTMLElementTagNameMap['dfn']>
    dialog: DialogHtmlAttributes<HTMLElementTagNameMap['dialog']>
    div: HTMLAttributes<HTMLElementTagNameMap['div']>
    dl: HTMLAttributes<HTMLElementTagNameMap['dl']>
    dt: HTMLAttributes<HTMLElementTagNameMap['dt']>
    em: HTMLAttributes<HTMLElementTagNameMap['em']>
    embed: EmbedHTMLAttributes<HTMLElementTagNameMap['embed']>
    fencedframe: FencedFrameHTMLAttributes<HTMLElementTagNameMap['fencedframe']>
    fieldset: FieldsetHTMLAttributes<HTMLElementTagNameMap['fieldset']>
    figcaption: HTMLAttributes<HTMLElementTagNameMap['figcaption']>
    figure: HTMLAttributes<HTMLElementTagNameMap['figure']>
    footer: HTMLAttributes<HTMLElementTagNameMap['footer']>
    form: FormHTMLAttributes<HTMLElementTagNameMap['form']>
    h1: HTMLAttributes<HTMLElementTagNameMap['h1']>
    h2: HTMLAttributes<HTMLElementTagNameMap['h2']>
    h3: HTMLAttributes<HTMLElementTagNameMap['h3']>
    h4: HTMLAttributes<HTMLElementTagNameMap['h4']>
    h5: HTMLAttributes<HTMLElementTagNameMap['h5']>
    h6: HTMLAttributes<HTMLElementTagNameMap['h6']>
    head: HTMLAttributes<HTMLElementTagNameMap['head']>
    header: HTMLAttributes<HTMLElementTagNameMap['header']>
    hgroup: HTMLAttributes<HTMLElementTagNameMap['hgroup']>
    hr: HTMLAttributes<HTMLElementTagNameMap['hr']>
    html: HTMLAttributes<HTMLElementTagNameMap['html']>
    i: HTMLAttributes<HTMLElementTagNameMap['i']>
    iframe: IframeHTMLAttributes<HTMLElementTagNameMap['iframe']>
    img: ImgHTMLAttributes<HTMLElementTagNameMap['img']>
    input: InputHTMLAttributes<HTMLElementTagNameMap['input']>
    ins: InsHTMLAttributes<HTMLElementTagNameMap['ins']>
    kbd: HTMLAttributes<HTMLElementTagNameMap['kbd']>
    label: LabelHTMLAttributes<HTMLElementTagNameMap['label']>
    legend: HTMLAttributes<HTMLElementTagNameMap['legend']>
    li: LiHTMLAttributes<HTMLElementTagNameMap['li']>
    link: LinkHTMLAttributes<HTMLElementTagNameMap['link']>
    main: HTMLAttributes<HTMLElementTagNameMap['main']>
    map: MapHTMLAttributes<HTMLElementTagNameMap['map']>
    mark: HTMLAttributes<HTMLElementTagNameMap['mark']>
    menu: HTMLAttributes<HTMLElementTagNameMap['menu']>
    meta: MetaHTMLAttributes<HTMLElementTagNameMap['meta']>
    meter: MeterHTMLAttributes<HTMLElementTagNameMap['meter']>
    nav: HTMLAttributes<HTMLElementTagNameMap['nav']>
    noscript: HTMLAttributes<HTMLElementTagNameMap['noscript']>
    object: ObjectHTMLAttributes<HTMLElementTagNameMap['object']>
    ol: OlHTMLAttributes<HTMLElementTagNameMap['ol']>
    optgroup: OptgroupHTMLAttributes<HTMLElementTagNameMap['optgroup']>
    option: OptionHTMLAttributes<HTMLElementTagNameMap['option']>
    output: OutputHTMLAttributes<HTMLElementTagNameMap['output']>
    p: HTMLAttributes<HTMLElementTagNameMap['p']>
    picture: HTMLAttributes<HTMLElementTagNameMap['picture']>
    pre: HTMLAttributes<HTMLElementTagNameMap['pre']>
    progress: ProgressHTMLAttributes<HTMLElementTagNameMap['progress']>
    q: QuoteHTMLAttributes<HTMLElementTagNameMap['q']>
    rp: HTMLAttributes<HTMLElementTagNameMap['rp']>
    rt: HTMLAttributes<HTMLElementTagNameMap['rt']>
    ruby: HTMLAttributes<HTMLElementTagNameMap['ruby']>
    s: HTMLAttributes<HTMLElementTagNameMap['s']>
    samp: HTMLAttributes<HTMLElementTagNameMap['samp']>
    script: ScriptHTMLAttributes<HTMLElementTagNameMap['script']>
    search: HTMLAttributes<HTMLElementTagNameMap['search']>
    section: HTMLAttributes<HTMLElementTagNameMap['section']>
    select: SelectHTMLAttributes<HTMLElementTagNameMap['select']>
    // selectedcontent: CssAttributes | StylePropertyAttributes
    slot: HTMLSlotElementAttributes<HTMLElementTagNameMap['slot']>
    small: HTMLAttributes<HTMLElementTagNameMap['small']>
    source: SourceHTMLAttributes<HTMLElementTagNameMap['source']>
    span: HTMLAttributes<HTMLElementTagNameMap['span']>
    strong: HTMLAttributes<HTMLElementTagNameMap['strong']>
    style: StyleHTMLAttributes<HTMLElementTagNameMap['style']>
    sub: HTMLAttributes<HTMLElementTagNameMap['sub']>
    summary: HTMLAttributes<HTMLElementTagNameMap['summary']>
    sup: HTMLAttributes<HTMLElementTagNameMap['sup']>
    table: TableHTMLAttributes<HTMLElementTagNameMap['table']>
    tbody: TableSectionHTMLAttributes<HTMLElementTagNameMap['tbody']>
    td: TableCellHTMLAttributes<HTMLElementTagNameMap['td']>
    template: TemplateHTMLAttributes<HTMLElementTagNameMap['template']>
    textarea: TextareaHTMLAttributes<HTMLElementTagNameMap['textarea']>
    tfoot: TableSectionHTMLAttributes<HTMLElementTagNameMap['tfoot']>
    th: TableCellHTMLAttributes<HTMLElementTagNameMap['th']>
    thead: TableSectionHTMLAttributes<HTMLElementTagNameMap['thead']>
    time: TimeHTMLAttributes<HTMLElementTagNameMap['time']>
    title: HTMLAttributes<HTMLElementTagNameMap['title']>
    tr: TableRowHTMLAttributes<HTMLElementTagNameMap['tr']>
    track: TrackHTMLAttributes<HTMLElementTagNameMap['track']>
    u: HTMLAttributes<HTMLElementTagNameMap['u']>
    ul: UlHTMLAttributes<HTMLElementTagNameMap['ul']>
    var: HTMLAttributes<HTMLElementTagNameMap['var']>
    video: VideoHTMLAttributes<HTMLElementTagNameMap['video']>
    wbr: HTMLAttributes<HTMLElementTagNameMap['wbr']>
  }
  /**
   * @type {HTMLElementDeprecatedTagNameMap}
   * @deprecated
   */
  interface HTMLElementDeprecatedTags {
    /** @deprecated */
    big: HTMLAttributes<HTMLElement>
    /** @deprecated */
    keygen: KeygenHTMLAttributes<HTMLElement>
    /** @deprecated */
    menuitem: HTMLAttributes<HTMLElement>
    /** @deprecated */
    noindex: HTMLAttributes<HTMLElement>
    /** @deprecated */
    param: ParamHTMLAttributes<HTMLParamElement>
  }

  interface IntrinsicElements
    extends ElementsAttributesAtomMaybe<HTMLElementTags>,
      ElementsAttributesAtomMaybe<HTMLElementDeprecatedTags>,
      ElementsAttributesAtomMaybe<SVGElementTags> {}
}
