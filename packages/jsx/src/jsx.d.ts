/**
 * stolen from https://github.dev/solidjs/solid/blob/49793e9452ecd034d4d2ef5f95108f5d2ff4134a/packages/solid/h/jsx-runtime/src/jsx.d.ts
 */

import { Atom, Ctx } from '@reatom/core'
import * as csstype from 'csstype'
import { JsxNode, Computable } from './types'

export namespace JSX {
  type EventHandler<T, E extends Event> = (
    ctx: Ctx,
    event: E & { currentTarget: T; target: Element },
  ) => void

  interface IntrinsicAttributes {}

  type ElementSpreadableProps<T> = Omit<T, `on${string}` | '$props'>
  type ElementSpread<T> =
    | ElementSpreadableProps<T>
    | Atom<ElementSpreadableProps<T>>
    | Array<ElementSpreadableProps<T> | Atom<ElementSpreadableProps<T>>>

  interface ElementProps<T = Element> extends CustomEventHandlers<T> {
    $props?: ElementSpread<this>
    children?: JsxNode
    [field: `field:${string}`]: any
    [css: `css:${string}`]: string | number | false | null | undefined

    oncopy?: EventHandler<T, ClipboardEvent>
    oncut?: EventHandler<T, ClipboardEvent>
    onpaste?: EventHandler<T, ClipboardEvent>
    oncompositionend?: EventHandler<T, CompositionEvent>
    oncompositionstart?: EventHandler<T, CompositionEvent>
    oncompositionupdate?: EventHandler<T, CompositionEvent>
    onfocusout?: EventHandler<T, FocusEvent>
    onfocusin?: EventHandler<T, FocusEvent>
    onencrypted?: EventHandler<T, Event>
    ondragexit?: EventHandler<T, DragEvent>
  }

  /**
   * @type {GlobalEventHandlers}
   */
  interface CustomEventHandlers<T> {
    onabort?: EventHandler<T, Event>
    onanimationend?: EventHandler<T, AnimationEvent>
    onanimationiteration?: EventHandler<T, AnimationEvent>
    onanimationstart?: EventHandler<T, AnimationEvent>
    onauxclick?: EventHandler<T, MouseEvent>
    onbeforeinput?: EventHandler<T, InputEvent>
    onblur?: EventHandler<T, FocusEvent>
    oncanplay?: EventHandler<T, Event>
    oncanplaythrough?: EventHandler<T, Event>
    onchange?: EventHandler<T, Event>
    onclick?: EventHandler<T, MouseEvent>
    oncontextmenu?: EventHandler<T, MouseEvent>
    ondblclick?: EventHandler<T, MouseEvent>
    ondrag?: EventHandler<T, DragEvent>
    ondragend?: EventHandler<T, DragEvent>
    ondragenter?: EventHandler<T, DragEvent>
    ondragleave?: EventHandler<T, DragEvent>
    ondragover?: EventHandler<T, DragEvent>
    ondragstart?: EventHandler<T, DragEvent>
    ondrop?: EventHandler<T, DragEvent>
    ondurationchange?: EventHandler<T, Event>
    onemptied?: EventHandler<T, Event>
    onended?: EventHandler<T, Event>
    onerror?: EventHandler<T, Event>
    onfocus?: EventHandler<T, FocusEvent>
    ongotpointercapture?: EventHandler<T, PointerEvent>
    oninput?: EventHandler<T, InputEvent>
    oninvalid?: EventHandler<T, Event>
    onkeydown?: EventHandler<T, KeyboardEvent>
    onkeypress?: EventHandler<T, KeyboardEvent>
    onkeyup?: EventHandler<T, KeyboardEvent>
    onload?: EventHandler<T, Event>
    onloadeddata?: EventHandler<T, Event>
    onloadedmetadata?: EventHandler<T, Event>
    onloadstart?: EventHandler<T, Event>
    onlostpointercapture?: EventHandler<T, PointerEvent>
    onmousedown?: EventHandler<T, MouseEvent>
    onmouseenter?: EventHandler<T, MouseEvent>
    onmouseleave?: EventHandler<T, MouseEvent>
    onmousemove?: EventHandler<T, MouseEvent>
    onmouseout?: EventHandler<T, MouseEvent>
    onmouseover?: EventHandler<T, MouseEvent>
    onmouseup?: EventHandler<T, MouseEvent>
    onpause?: EventHandler<T, Event>
    onplay?: EventHandler<T, Event>
    onplaying?: EventHandler<T, Event>
    onpointercancel?: EventHandler<T, PointerEvent>
    onpointerdown?: EventHandler<T, PointerEvent>
    onpointerenter?: EventHandler<T, PointerEvent>
    onpointerleave?: EventHandler<T, PointerEvent>
    onpointermove?: EventHandler<T, PointerEvent>
    onpointerout?: EventHandler<T, PointerEvent>
    onpointerover?: EventHandler<T, PointerEvent>
    onpointerup?: EventHandler<T, PointerEvent>
    onprogress?: EventHandler<T, Event>
    onratechange?: EventHandler<T, Event>
    onreset?: EventHandler<T, Event>
    onscroll?: EventHandler<T, UIEvent>
    onseeked?: EventHandler<T, Event>
    onseeking?: EventHandler<T, Event>
    onselect?: EventHandler<T, UIEvent>
    onstalled?: EventHandler<T, Event>
    onsubmit?: EventHandler<T, Event & { submitter: HTMLElement }>
    onsuspend?: EventHandler<T, Event>
    ontimeupdate?: EventHandler<T, Event>
    ontouchcancel?: EventHandler<T, TouchEvent>
    ontouchend?: EventHandler<T, TouchEvent>
    ontouchmove?: EventHandler<T, TouchEvent>
    ontouchstart?: EventHandler<T, TouchEvent>
    ontransitionend?: EventHandler<T, TransitionEvent>
    onvolumechange?: EventHandler<T, Event>
    onwaiting?: EventHandler<T, Event>
    onwheel?: EventHandler<T, WheelEvent>
  }

  interface CSSProperties extends csstype.PropertiesHyphen {
    // Override
    [key: `-${string}`]: string | number | undefined
  }

  type HTMLAutocapitalize =
    | 'off'
    | 'none'
    | 'on'
    | 'sentences'
    | 'words'
    | 'characters'
  type HTMLDir = 'ltr' | 'rtl' | 'auto'
  type HTMLFormEncType =
    | 'application/x-www-form-urlencoded'
    | 'multipart/form-data'
    | 'text/plain'
  type HTMLFormMethod = 'post' | 'get' | 'dialog'
  type HTMLCrossorigin = 'anonymous' | 'use-credentials' | ''
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

  // All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/
  interface AriaProps {
    /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
    'aria-activedescendant'?: string
    /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
    'aria-atomic'?: boolean | 'false' | 'true'
    /**
     * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
     * presented if they are made.
     */
    'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both'
    /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
    'aria-busy'?: boolean | 'false' | 'true'
    /**
     * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
     * @see aria-pressed @see aria-selected.
     */
    'aria-checked'?: boolean | 'false' | 'mixed' | 'true'
    /**
     * Defines the total number of columns in a table, grid, or treegrid.
     * @see aria-colindex.
     */
    'aria-colcount'?: number | string
    /**
     * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
     * @see aria-colcount @see aria-colspan.
     */
    'aria-colindex'?: number | string
    /**
     * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-colindex @see aria-rowspan.
     */
    'aria-colspan'?: number | string
    /**
     * Identifies the element (or elements) whose contents or presence are controlled by the current element.
     * @see aria-owns.
     */
    'aria-controls'?: string
    /** Indicates the element that represents the current item within a container or set of related elements. */
    'aria-current'?:
      | boolean
      | 'false'
      | 'true'
      | 'page'
      | 'step'
      | 'location'
      | 'date'
      | 'time'
    /**
     * Identifies the element (or elements) that describes the object.
     * @see aria-labelledby
     */
    'aria-describedby'?: string
    /**
     * Identifies the element that provides a detailed, extended description for the object.
     * @see aria-describedby.
     */
    'aria-details'?: string
    /**
     * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
     * @see aria-hidden @see aria-readonly.
     */
    'aria-disabled'?: boolean | 'false' | 'true'
    /**
     * Indicates what functions can be performed when a dragged object is released on the drop target.
     * @deprecated in ARIA 1.1
     */
    'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup'
    /**
     * Identifies the element that provides an error message for the object.
     * @see aria-invalid @see aria-describedby.
     */
    'aria-errormessage'?: string
    /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
    'aria-expanded'?: boolean | 'false' | 'true'
    /**
     * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
     * allows assistive technology to override the general default of reading in document source order.
     */
    'aria-flowto'?: string
    /**
     * Indicates an element's "grabbed" state in a drag-and-drop operation.
     * @deprecated in ARIA 1.1
     */
    'aria-grabbed'?: boolean | 'false' | 'true'
    /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
    'aria-haspopup'?:
      | boolean
      | 'false'
      | 'true'
      | 'menu'
      | 'listbox'
      | 'tree'
      | 'grid'
      | 'dialog'
    /**
     * Indicates whether the element is exposed to an accessibility API.
     * @see aria-disabled.
     */
    'aria-hidden'?: boolean | 'false' | 'true'
    /**
     * Indicates the entered value does not conform to the format expected by the application.
     * @see aria-errormessage.
     */
    'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling'
    /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
    'aria-keyshortcuts'?: string
    /**
     * Defines a string value that labels the current element.
     * @see aria-labelledby.
     */
    'aria-label'?: string
    /**
     * Identifies the element (or elements) that labels the current element.
     * @see aria-describedby.
     */
    'aria-labelledby'?: string
    /** Defines the hierarchical level of an element within a structure. */
    'aria-level'?: number | string
    /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
    'aria-live'?: 'off' | 'assertive' | 'polite'
    /** Indicates whether an element is modal when displayed. */
    'aria-modal'?: boolean | 'false' | 'true'
    /** Indicates whether a text box accepts multiple lines of input or only a single line. */
    'aria-multiline'?: boolean | 'false' | 'true'
    /** Indicates that the user may select more than one item from the current selectable descendants. */
    'aria-multiselectable'?: boolean | 'false' | 'true'
    /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
    'aria-orientation'?: 'horizontal' | 'vertical'
    /**
     * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
     * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
     * @see aria-controls.
     */
    'aria-owns'?: string
    /**
     * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
     * A hint could be a sample value or a brief description of the expected format.
     */
    'aria-placeholder'?: string
    /**
     * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-setsize.
     */
    'aria-posinset'?: number | string
    /**
     * Indicates the current "pressed" state of toggle buttons.
     * @see aria-checked @see aria-selected.
     */
    'aria-pressed'?: boolean | 'false' | 'mixed' | 'true'
    /**
     * Indicates that the element is not editable, but is otherwise operable.
     * @see aria-disabled.
     */
    'aria-readonly'?: boolean | 'false' | 'true'
    /**
     * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
     * @see aria-atomic.
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
    /** Indicates that user input is required on the element before a form may be submitted. */
    'aria-required'?: boolean | 'false' | 'true'
    /** Defines a human-readable, author-localized description for the role of an element. */
    'aria-roledescription'?: string
    /**
     * Defines the total number of rows in a table, grid, or treegrid.
     * @see aria-rowindex.
     */
    'aria-rowcount'?: number | string
    /**
     * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
     * @see aria-rowcount @see aria-rowspan.
     */
    'aria-rowindex'?: number | string
    /**
     * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-rowindex @see aria-colspan.
     */
    'aria-rowspan'?: number | string
    /**
     * Indicates the current "selected" state of various widgets.
     * @see aria-checked @see aria-pressed.
     */
    'aria-selected'?: boolean | 'false' | 'true'
    /**
     * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-posinset.
     */
    'aria-setsize'?: number | string
    /** Indicates if items in a table or grid are sorted in ascending or descending order. */
    'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other'
    /** Defines the maximum allowed value for a range widget. */
    'aria-valuemax'?: number | string
    /** Defines the minimum allowed value for a range widget. */
    'aria-valuemin'?: number | string
    /**
     * Defines the current value for a range widget.
     * @see aria-valuetext.
     */
    'aria-valuenow'?: number | string
    /** Defines the human readable text alternative of aria-valuenow for a range widget. */
    'aria-valuetext'?: string
    role?: Computable<
      | 'alert'
      | 'alertdialog'
      | 'application'
      | 'article'
      | 'banner'
      | 'button'
      | 'cell'
      | 'checkbox'
      | 'columnheader'
      | 'combobox'
      | 'complementary'
      | 'contentinfo'
      | 'definition'
      | 'dialog'
      | 'directory'
      | 'document'
      | 'feed'
      | 'figure'
      | 'form'
      | 'grid'
      | 'gridcell'
      | 'group'
      | 'heading'
      | 'img'
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
      | 'presentation'
      | 'progressbar'
      | 'radio'
      | 'radiogroup'
      | 'region'
      | 'row'
      | 'rowgroup'
      | 'rowheader'
      | 'scrollbar'
      | 'search'
      | 'searchbox'
      | 'separator'
      | 'slider'
      | 'spinbutton'
      | 'status'
      | 'switch'
      | 'tab'
      | 'table'
      | 'tablist'
      | 'tabpanel'
      | 'term'
      | 'textbox'
      | 'timer'
      | 'toolbar'
      | 'tooltip'
      | 'tree'
      | 'treegrid'
      | 'treeitem'
    >
  }

  interface HTMLAttributes<T> extends AriaProps, ElementProps<T> {
    accessKey?: Computable<string>
    class?: Computable<string> | undefined
    className?: Computable<string>
    contenteditable?: Computable<boolean | 'inherit'>
    contextmenu?: Computable<string>
    dir?: Computable<HTMLDir>
    draggable?: Computable<boolean>
    hidden?: Computable<boolean>
    id?: Computable<string>
    lang?: Computable<string>
    spellcheck?: Computable<boolean>
    style?: Computable<CSSProperties | string>
    tabindex?: Computable<number | string>
    title?: Computable<string>
    translate?: Computable<'yes' | 'no'>
    about?: Computable<string>
    datatype?: Computable<string>
    inlist?: Computable<any>
    prefix?: Computable<string>
    property?: Computable<string>
    resource?: Computable<string>
    typeof?: Computable<string>
    vocab?: Computable<string>
    autocapitalize?: Computable<HTMLAutocapitalize>
    slot?: Computable<string>
    color?: Computable<string>
    itemprop?: Computable<string>
    itemscope?: Computable<boolean>
    itemtype?: Computable<string>
    itemid?: Computable<string>
    itemref?: Computable<string>
    part?: Computable<string>
    exportparts?: Computable<string>
    inputmode?: Computable<
      | 'none'
      | 'text'
      | 'tel'
      | 'url'
      | 'email'
      | 'numeric'
      | 'decimal'
      | 'search'
    >
    contentEditable?: Computable<boolean | 'inherit'>
    contextMenu?: Computable<string>
    tabIndex?: Computable<number | string>
    autoCapitalize?: Computable<HTMLAutocapitalize>
    itemProp?: Computable<string>
    itemScope?: Computable<boolean>
    itemType?: Computable<string>
    itemId?: Computable<string>
    itemRef?: Computable<string>
    exportParts?: Computable<string>
    inputMode?: Computable<
      | 'none'
      | 'text'
      | 'tel'
      | 'url'
      | 'email'
      | 'numeric'
      | 'decimal'
      | 'search'
    >
  }
  interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
    download?: Computable<any>
    href?: Computable<string>
    hreflang?: Computable<string>
    media?: Computable<string>
    ping?: Computable<string>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    rel?: Computable<string>
    target?: Computable<string>
    type?: Computable<string>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
  }
  interface AudioHTMLAttributes<T> extends MediaHTMLAttributes<T> {}
  interface AreaHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: Computable<string>
    coords?: Computable<string>
    download?: Computable<any>
    href?: Computable<string>
    hreflang?: Computable<string>
    ping?: Computable<string>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    rel?: Computable<string>
    shape?: Computable<'rect' | 'circle' | 'poly' | 'default'>
    target?: Computable<string>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
  }
  interface BaseHTMLAttributes<T> extends HTMLAttributes<T> {
    href?: Computable<string>
    target?: Computable<string>
  }
  interface BlockquoteHTMLAttributes<T> extends HTMLAttributes<T> {
    cite?: Computable<string>
  }
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    autofocus?: Computable<boolean>
    disabled?: Computable<boolean>
    form?: Computable<string>
    formaction?: Computable<string>
    formenctype?: Computable<HTMLFormEncType>
    formmethod?: Computable<HTMLFormMethod>
    formnovalidate?: Computable<boolean>
    formtarget?: Computable<string>
    name?: Computable<string>
    type?: Computable<'submit' | 'reset' | 'button'>
    value?: Computable<string>
    formAction?: Computable<string>
    formEnctype?: Computable<HTMLFormEncType>
    formMethod?: Computable<HTMLFormMethod>
    formNoValidate?: Computable<boolean>
    formTarget?: Computable<string>
  }
  interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
    width?: Computable<number | string>
    height?: Computable<number | string>
  }
  interface ColHTMLAttributes<T> extends HTMLAttributes<T> {
    span?: Computable<number | string>
    width?: Computable<number | string>
  }
  interface ColgroupHTMLAttributes<T> extends HTMLAttributes<T> {
    span?: Computable<number | string>
  }
  interface DataHTMLAttributes<T> extends HTMLAttributes<T> {
    value?: Computable<string | string[] | number>
  }
  interface DetailsHtmlAttributes<T> extends HTMLAttributes<T> {
    open?: Computable<boolean>
    ontoggle?: EventHandler<T, Event>
  }
  interface DialogHtmlAttributes<T> extends HTMLAttributes<T> {
    open?: Computable<boolean>
  }
  interface EmbedHTMLAttributes<T> extends HTMLAttributes<T> {
    height?: Computable<number | string>
    src?: Computable<string>
    type?: Computable<string>
    width?: Computable<number | string>
  }
  interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: Computable<boolean>
    form?: Computable<string>
    name?: Computable<string>
  }
  interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    acceptcharset?: Computable<string>
    action?: Computable<string>
    autocomplete?: Computable<string>
    encoding?: Computable<HTMLFormEncType>
    enctype?: Computable<HTMLFormEncType>
    method?: Computable<HTMLFormMethod>
    name?: Computable<string>
    novalidate?: Computable<boolean>
    target?: Computable<string>
    acceptCharset?: Computable<string>
    noValidate?: Computable<boolean>
  }
  interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
    allow?: Computable<string>
    allowfullscreen?: Computable<boolean>
    height?: Computable<number | string>
    name?: Computable<string>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    sandbox?: HTMLIframeSandbox | string
    src?: Computable<string>
    srcdoc?: Computable<string>
    width?: Computable<number | string>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
  }
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: Computable<string>
    crossorigin?: Computable<HTMLCrossorigin>
    decoding?: Computable<'sync' | 'async' | 'auto'>
    height?: Computable<number | string>
    ismap?: Computable<boolean>
    isMap?: Computable<boolean>
    loading?: Computable<'eager' | 'lazy'>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
    sizes?: Computable<string>
    src?: Computable<string>
    srcset?: Computable<string>
    srcSet?: Computable<string>
    usemap?: Computable<string>
    useMap?: Computable<string>
    width?: Computable<number | string>
    crossOrigin?: Computable<HTMLCrossorigin>
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    accept?: Computable<string>
    alt?: Computable<string>
    autocomplete?: Computable<string>
    autofocus?: Computable<boolean>
    capture?: Computable<boolean | string>
    checked?: Computable<boolean>
    crossorigin?: Computable<HTMLCrossorigin>
    disabled?: Computable<boolean>
    form?: Computable<string>
    formaction?: Computable<string>
    formenctype?: Computable<HTMLFormEncType>
    formmethod?: Computable<HTMLFormMethod>
    formnovalidate?: Computable<boolean>
    formtarget?: Computable<string>
    height?: Computable<number | string>
    list?: Computable<string>
    max?: Computable<number | string>
    maxlength?: Computable<number | string>
    min?: Computable<number | string>
    minlength?: Computable<number | string>
    multiple?: Computable<boolean>
    name?: Computable<string>
    pattern?: Computable<string>
    placeholder?: Computable<string>
    readonly?: Computable<boolean>
    required?: Computable<boolean>
    size?: Computable<number | string>
    src?: Computable<string>
    step?: Computable<number | string>
    type?: Computable<string>
    value?: Computable<string | string[] | number>
    width?: Computable<number | string>
    crossOrigin?: Computable<HTMLCrossorigin>
    formAction?: Computable<string>
    formEnctype?: Computable<HTMLFormEncType>
    formMethod?: Computable<HTMLFormMethod>
    formNoValidate?: Computable<boolean>
    formTarget?: Computable<string>
    maxLength?: Computable<number | string>
    minLength?: Computable<number | string>
    readOnly?: Computable<boolean>
  }
  interface InsHTMLAttributes<T> extends HTMLAttributes<T> {
    cite?: Computable<string>
    dateTime?: Computable<string>
  }
  interface KeygenHTMLAttributes<T> extends HTMLAttributes<T> {
    autofocus?: Computable<boolean>
    challenge?: Computable<string>
    disabled?: Computable<boolean>
    form?: Computable<string>
    keytype?: Computable<string>
    keyparams?: Computable<string>
    name?: Computable<string>
  }
  interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
    for?: Computable<string>
    form?: Computable<string>
  }
  interface LiHTMLAttributes<T> extends HTMLAttributes<T> {
    value?: Computable<number | string>
  }
  interface LinkHTMLAttributes<T> extends HTMLAttributes<T> {
    as?: Computable<HTMLLinkAs>
    crossorigin?: Computable<HTMLCrossorigin>
    disabled?: Computable<boolean>
    href?: Computable<string>
    hreflang?: Computable<string>
    integrity?: Computable<string>
    media?: Computable<string>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    rel?: Computable<string>
    sizes?: Computable<string>
    type?: Computable<string>
    crossOrigin?: Computable<HTMLCrossorigin>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
  }
  interface MapHTMLAttributes<T> extends HTMLAttributes<T> {
    name?: Computable<string>
  }
  interface MediaHTMLAttributes<T> extends HTMLAttributes<T> {
    autoplay?: Computable<boolean>
    controls?: Computable<boolean>
    crossorigin?: Computable<HTMLCrossorigin>
    loop?: Computable<boolean>
    mediagroup?: Computable<string>
    muted?: Computable<boolean>
    preload?: Computable<'none' | 'metadata' | 'auto' | ''>
    src?: Computable<string>
    crossOrigin?: Computable<HTMLCrossorigin>
    mediaGroup?: Computable<string>
  }
  interface MenuHTMLAttributes<T> extends HTMLAttributes<T> {
    label?: Computable<string>
    type?: Computable<'context' | 'toolbar'>
  }
  interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
    charset?: Computable<string>
    content?: Computable<string>
    httpequiv?: Computable<string>
    name?: Computable<string>
    httpEquiv?: Computable<string>
  }
  interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
    form?: Computable<string>
    high?: Computable<number | string>
    low?: Computable<number | string>
    max?: Computable<number | string>
    min?: Computable<number | string>
    optimum?: Computable<number | string>
    value?: Computable<string | string[] | number>
  }
  interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> {
    cite?: Computable<string>
  }
  interface ObjectHTMLAttributes<T> extends HTMLAttributes<T> {
    data?: Computable<string>
    form?: Computable<string>
    height?: Computable<number | string>
    name?: Computable<string>
    type?: Computable<string>
    usemap?: Computable<string>
    width?: Computable<number | string>
    useMap?: Computable<string>
  }
  interface OlHTMLAttributes<T> extends HTMLAttributes<T> {
    reversed?: Computable<boolean>
    start?: Computable<number | string>
    type?: Computable<'1' | 'a' | 'A' | 'i' | 'I'>
  }
  interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: Computable<boolean>
    label?: Computable<string>
  }
  interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: Computable<boolean>
    label?: Computable<string>
    selected?: Computable<boolean>
    value?: Computable<string | string[] | number>
  }
  interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
    form?: Computable<string>
    for?: Computable<string>
    name?: Computable<string>
  }
  interface ParamHTMLAttributes<T> extends HTMLAttributes<T> {
    name?: Computable<string>
    value?: Computable<string | string[] | number>
  }
  interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> {
    max?: Computable<number | string>
    value?: Computable<string | string[] | number>
  }
  interface ScriptHTMLAttributes<T> extends HTMLAttributes<T> {
    async?: Computable<boolean>
    charset?: Computable<string>
    crossorigin?: Computable<HTMLCrossorigin>
    defer?: Computable<boolean>
    integrity?: Computable<string>
    nomodule?: Computable<boolean>
    nonce?: Computable<string>
    referrerpolicy?: Computable<HTMLReferrerPolicy>
    src?: Computable<string>
    type?: Computable<string>
    crossOrigin?: Computable<HTMLCrossorigin>
    noModule?: Computable<boolean>
    referrerPolicy?: Computable<HTMLReferrerPolicy>
  }
  interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
    autocomplete?: Computable<string>
    autofocus?: Computable<boolean>
    disabled?: Computable<boolean>
    form?: Computable<string>
    multiple?: Computable<boolean>
    name?: Computable<string>
    required?: Computable<boolean>
    size?: Computable<number | string>
    value?: Computable<string | string[] | number>
  }
  interface HTMLSlotElementAttributes<T = HTMLSlotElement>
    extends HTMLAttributes<T> {
    name?: Computable<string>
  }
  interface SourceHTMLAttributes<T> extends HTMLAttributes<T> {
    media?: Computable<string>
    sizes?: Computable<string>
    src?: Computable<string>
    srcset?: Computable<string>
    type?: Computable<string>
  }
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    media?: Computable<string>
    nonce?: Computable<string>
    scoped?: Computable<boolean>
    type?: Computable<string>
  }
  interface TdHTMLAttributes<T> extends HTMLAttributes<T> {
    colspan?: Computable<number | string>
    headers?: Computable<string>
    rowspan?: Computable<number | string>
    colSpan?: Computable<number | string>
    rowSpan?: Computable<number | string>
  }
  interface TemplateHTMLAttributes<T extends HTMLTemplateElement>
    extends HTMLAttributes<T> {
    content?: Computable<DocumentFragment>
  }
  interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
    autocomplete?: Computable<string>
    autofocus?: Computable<boolean>
    cols?: Computable<number | string>
    dirname?: Computable<string>
    disabled?: Computable<boolean>
    form?: Computable<string>
    maxlength?: Computable<number | string>
    minlength?: Computable<number | string>
    name?: Computable<string>
    placeholder?: Computable<string>
    readonly?: Computable<boolean>
    required?: Computable<boolean>
    rows?: Computable<number | string>
    value?: Computable<string | string[] | number>
    wrap?: Computable<'hard' | 'soft' | 'off'>
    maxLength?: Computable<number | string>
    minLength?: Computable<number | string>
    readOnly?: Computable<boolean>
  }
  interface ThHTMLAttributes<T> extends HTMLAttributes<T> {
    colspan?: Computable<number | string>
    headers?: Computable<string>
    rowspan?: Computable<number | string>
    colSpan?: Computable<number | string>
    rowSpan?: Computable<number | string>
    scope?: Computable<'col' | 'row' | 'rowgroup' | 'colgroup'>
  }
  interface TimeHTMLAttributes<T> extends HTMLAttributes<T> {
    datetime?: Computable<string>
    dateTime?: Computable<string>
  }
  interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
    default?: Computable<boolean>
    kind?: Computable<
      'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'
    >
    label?: Computable<string>
    src?: Computable<string>
    srclang?: Computable<string>
  }
  interface VideoHTMLAttributes<T> extends MediaHTMLAttributes<T> {
    height?: Computable<number | string>
    playsinline?: Computable<boolean>
    poster?: Computable<string>
    width?: Computable<number | string>
  }
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
  interface CoreSVGAttributes<T> extends AriaProps, ElementProps<T> {
    id?: Computable<string>
    lang?: Computable<string>
    tabIndex?: Computable<number | string>
    tabindex?: Computable<number | string>
  }
  interface StylableSVGAttributes {
    class?: Computable<string> | undefined
    style?: Computable<CSSProperties | string>
  }
  interface TransformableSVGAttributes {
    transform?: Computable<string>
  }
  interface ConditionalProcessingSVGAttributes {
    requiredExtensions?: Computable<string>
    requiredFeatures?: Computable<string>
    systemLanguage?: Computable<string>
  }
  interface ExternalResourceSVGAttributes {
    externalResourcesRequired?: Computable<'true' | 'false'>
  }
  interface AnimationTimingSVGAttributes {
    begin?: Computable<string>
    dur?: Computable<string>
    end?: Computable<string>
    min?: Computable<string>
    max?: Computable<string>
    restart?: Computable<'always' | 'whenNotActive' | 'never'>
    repeatCount?: Computable<number | 'indefinite'>
    repeatDur?: Computable<string>
    fill?: Computable<'freeze' | 'remove'>
  }
  interface AnimationValueSVGAttributes {
    calcMode?: Computable<'discrete' | 'linear' | 'paced' | 'spline'>
    values?: Computable<string>
    keyTimes?: Computable<string>
    keySplines?: Computable<string>
    from?: Computable<number | string>
    to?: Computable<number | string>
    by?: Computable<number | string>
  }
  interface AnimationAdditionSVGAttributes {
    attributeName?: Computable<string>
    additive?: Computable<'replace' | 'sum'>
    accumulate?: Computable<'none' | 'sum'>
  }
  interface AnimationAttributeTargetSVGAttributes {
    attributeName?: Computable<string>
    attributeType?: Computable<'CSS' | 'XML' | 'auto'>
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
    'baseline-shift'?: Computable<number | string>
    clip?: Computable<string>
    'clip-path'?: Computable<string>
    'clip-rule'?: 'nonzero' | 'evenodd' | 'inherit'
    color?: Computable<string>
    'color-interpolation'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit'
    'color-interpolation-filters'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit'
    'color-profile'?: Computable<string>
    'color-rendering'?: 'auto' | 'optimizeSpeed' | 'optimizeQuality' | 'inherit'
    cursor?: Computable<string>
    direction?: 'ltr' | 'rtl' | 'inherit'
    display?: Computable<string>
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
    'enable-background'?: Computable<string>
    fill?: Computable<string>
    'fill-opacity'?: Computable<number | string | 'inherit'>
    'fill-rule'?: Computable<'nonzero' | 'evenodd' | 'inherit'>
    filter?: Computable<string>
    'flood-color'?: Computable<string>
    'flood-opacity'?: Computable<number | string | 'inherit'>
    'font-family'?: Computable<string>
    'font-size'?: Computable<string>
    'font-size-adjust'?: Computable<number | string>
    'font-stretch'?: Computable<string>
    'font-style'?: Computable<'normal' | 'italic' | 'oblique' | 'inherit'>
    'font-variant'?: Computable<string>
    'font-weight'?: Computable<number | string>
    'glyph-orientation-horizontal'?: Computable<string>
    'glyph-orientation-vertical'?: Computable<string>
    'image-rendering'?: Computable<
      'auto' | 'optimizeQuality' | 'optimizeSpeed' | 'inherit'
    >
    kerning?: Computable<string>
    'letter-spacing'?: Computable<number | string>
    'lighting-color'?: Computable<string>
    'marker-end'?: Computable<string>
    'marker-mid'?: Computable<string>
    'marker-start'?: Computable<string>
    mask?: Computable<string>
    opacity?: Computable<number | string | 'inherit'>
    overflow?: Computable<'visible' | 'hidden' | 'scroll' | 'auto' | 'inherit'>
    'pointer-events'?: Computable<
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
    >
    'shape-rendering'?: Computable<
      'auto' | 'optimizeSpeed' | 'crispEdges' | 'geometricPrecision' | 'inherit'
    >
    'stop-color'?: Computable<string>
    'stop-opacity'?: Computable<number | string | 'inherit'>
    stroke?: Computable<string>
    'stroke-dasharray'?: Computable<string>
    'stroke-dashoffset'?: Computable<number | string>
    'stroke-linecap'?: Computable<'butt' | 'round' | 'square' | 'inherit'>
    'stroke-linejoin'?: Computable<
      'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round' | 'inherit'
    >
    'stroke-miterlimit'?: Computable<number | string | 'inherit'>
    'stroke-opacity'?: Computable<number | string | 'inherit'>
    'stroke-width'?: Computable<number | string>
    'text-anchor'?: Computable<'start' | 'middle' | 'end' | 'inherit'>
    'text-decoration'?: Computable<
      'none' | 'underline' | 'overline' | 'line-through' | 'blink' | 'inherit'
    >
    'text-rendering'?: Computable<
      | 'auto'
      | 'optimizeSpeed'
      | 'optimizeLegibility'
      | 'geometricPrecision'
      | 'inherit'
    >
    'unicode-bidi'?: Computable<string>
    visibility?: Computable<'visible' | 'hidden' | 'collapse' | 'inherit'>
    'word-spacing'?: Computable<number | string>
    'writing-mode'?: Computable<
      'lr-tb' | 'rl-tb' | 'tb-rl' | 'lr' | 'rl' | 'tb' | 'inherit'
    >
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
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    result?: Computable<string>
  }
  interface SingleInputFilterSVGAttributes {
    in?: Computable<string>
  }
  interface DoubleInputFilterSVGAttributes {
    in?: Computable<string>
    in2?: Computable<string>
  }
  interface FitToViewBoxSVGAttributes {
    viewBox?: Computable<string>
    preserveAspectRatio?: Computable<SVGPreserveAspectRatio>
  }
  interface GradientElementSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    gradientUnits?: Computable<SVGUnits>
    gradientTransform?: Computable<string>
    spreadMethod?: Computable<'pad' | 'reflect' | 'repeat'>
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
    viewBox?: Computable<string>
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
    zoomAndPan?: Computable<'disable' | 'magnify'>
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
    path?: Computable<string>
    keyPoints?: Computable<string>
    rotate?: Computable<number | string | 'auto' | 'auto-reverse'>
    origin?: Computable<'default'>
  }
  interface AnimateTransformSVGAttributes<T>
    extends AnimationElementSVGAttributes<T>,
      AnimationAttributeTargetSVGAttributes,
      AnimationTimingSVGAttributes,
      AnimationValueSVGAttributes,
      AnimationAdditionSVGAttributes {
    type?: Computable<'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY'>
  }
  interface CircleSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    cx?: Computable<number | string>
    cy?: Computable<number | string>
    r?: Computable<number | string>
  }
  interface ClipPathSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'clip-path'> {
    clipPathUnits?: Computable<SVGUnits>
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
    cx?: Computable<number | string>
    cy?: Computable<number | string>
    rx?: Computable<number | string>
    ry?: Computable<number | string>
  }
  interface FeBlendSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    mode?: Computable<'normal' | 'multiply' | 'screen' | 'darken' | 'lighten'>
  }
  interface FeColorMatrixSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    type?: Computable<'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha'>
    values?: Computable<string>
  }
  interface FeComponentTransferSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {}
  interface FeCompositeSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    operator?: Computable<'over' | 'in' | 'out' | 'atop' | 'xor' | 'arithmetic'>
    k1?: Computable<number | string>
    k2?: Computable<number | string>
    k3?: Computable<number | string>
    k4?: Computable<number | string>
  }
  interface FeConvolveMatrixSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    order?: Computable<number | string>
    kernelMatrix?: Computable<string>
    divisor?: Computable<number | string>
    bias?: Computable<number | string>
    targetX?: Computable<number | string>
    targetY?: Computable<number | string>
    edgeMode?: Computable<'duplicate' | 'wrap' | 'none'>
    kernelUnitLength?: Computable<number | string>
    preserveAlpha?: Computable<'true' | 'false'>
  }
  interface FeDiffuseLightingSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'lighting-color'> {
    surfaceScale?: Computable<number | string>
    diffuseConstant?: Computable<number | string>
    kernelUnitLength?: Computable<number | string>
  }
  interface FeDisplacementMapSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      DoubleInputFilterSVGAttributes,
      StylableSVGAttributes {
    scale?: Computable<number | string>
    xChannelSelector?: Computable<'R' | 'G' | 'B' | 'A'>
    yChannelSelector?: Computable<'R' | 'G' | 'B' | 'A'>
  }
  interface FeDistantLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    azimuth?: Computable<number | string>
    elevation?: Computable<number | string>
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
    tableValues?: Computable<string>
    slope?: Computable<number | string>
    intercept?: Computable<number | string>
    amplitude?: Computable<number | string>
    exponent?: Computable<number | string>
    offset?: Computable<number | string>
  }
  interface FeGaussianBlurSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    stdDeviation?: Computable<number | string>
  }
  interface FeImageSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    preserveAspectRatio?: Computable<SVGPreserveAspectRatio>
    href?: Computable<string>
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
    operator?: Computable<'erode' | 'dilate'>
    radius?: Computable<number | string>
  }
  interface FeOffsetSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {
    dx?: Computable<number | string>
    dy?: Computable<number | string>
  }
  interface FePointLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    x?: Computable<number | string>
    y?: Computable<number | string>
    z?: Computable<number | string>
  }
  interface FeSpecularLightingSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'lighting-color'> {
    surfaceScale?: Computable<string>
    specularConstant?: Computable<string>
    specularExponent?: Computable<string>
    kernelUnitLength?: Computable<number | string>
  }
  interface FeSpotLightSVGAttributes<T>
    extends LightSourceElementSVGAttributes<T> {
    x?: Computable<number | string>
    y?: Computable<number | string>
    z?: Computable<number | string>
    pointsAtX?: Computable<number | string>
    pointsAtY?: Computable<number | string>
    pointsAtZ?: Computable<number | string>
    specularExponent?: Computable<number | string>
    limitingConeAngle?: Computable<number | string>
  }
  interface FeTileSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      SingleInputFilterSVGAttributes,
      StylableSVGAttributes {}
  interface FeTurbulanceSVGAttributes<T>
    extends FilterPrimitiveElementSVGAttributes<T>,
      StylableSVGAttributes {
    baseFrequency?: Computable<number | string>
    numOctaves?: Computable<number | string>
    seed?: Computable<number | string>
    stitchTiles?: Computable<'stitch' | 'noStitch'>
    type?: Computable<'fractalNoise' | 'turbulence'>
  }
  interface FilterSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    filterUnits?: Computable<SVGUnits>
    primitiveUnits?: Computable<SVGUnits>
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    filterRes?: Computable<number | string>
  }
  interface ForeignObjectSVGAttributes<T>
    extends NewViewportSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'display' | 'visibility'> {
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
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
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    preserveAspectRatio?: Computable<ImagePreserveAspectRatio>
    href?: Computable<string>
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
    x1?: Computable<number | string>
    y1?: Computable<number | string>
    x2?: Computable<number | string>
    y2?: Computable<number | string>
  }
  interface LinearGradientSVGAttributes<T>
    extends GradientElementSVGAttributes<T> {
    x1?: Computable<number | string>
    x2?: Computable<number | string>
    y1?: Computable<number | string>
    y2?: Computable<number | string>
  }
  interface MarkerSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes,
      Pick<PresentationSVGAttributes, 'overflow' | 'clip'> {
    markerUnits?: Computable<'strokeWidth' | 'userSpaceOnUse'>
    refX?: Computable<number | string>
    refY?: Computable<number | string>
    markerWidth?: Computable<number | string>
    markerHeight?: Computable<number | string>
    orient?: Computable<string>
  }
  interface MaskSVGAttributes<T>
    extends Omit<ContainerElementSVGAttributes<T>, 'opacity' | 'filter'>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes {
    maskUnits?: Computable<SVGUnits>
    maskContentUnits?: Computable<SVGUnits>
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
  }
  interface MetadataSVGAttributes<T> extends CoreSVGAttributes<T> {}
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
    d?: Computable<string>
    pathLength?: Computable<number | string>
  }
  interface PatternSVGAttributes<T>
    extends ContainerElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      FitToViewBoxSVGAttributes,
      Pick<PresentationSVGAttributes, 'overflow' | 'clip'> {
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    patternUnits?: Computable<SVGUnits>
    patternContentUnits?: Computable<SVGUnits>
    patternTransform?: Computable<string>
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
    points?: Computable<string>
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
    points?: Computable<string>
  }
  interface RadialGradientSVGAttributes<T>
    extends GradientElementSVGAttributes<T> {
    cx?: Computable<number | string>
    cy?: Computable<number | string>
    r?: Computable<number | string>
    fx?: Computable<number | string>
    fy?: Computable<number | string>
  }
  interface RectSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ShapeElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    rx?: Computable<number | string>
    ry?: Computable<number | string>
  }
  interface StopSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      StylableSVGAttributes,
      Pick<PresentationSVGAttributes, 'color' | 'stop-color' | 'stop-opacity'> {
    offset?: Computable<number | string>
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
    version?: Computable<string>
    baseProfile?: Computable<string>
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    contentScriptType?: Computable<string>
    contentStyleType?: Computable<string>
    xmlns?: Computable<string>
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
      FitToViewBoxSVGAttributes {}
  interface TextSVGAttributes<T>
    extends TextContentElementSVGAttributes<T>,
      GraphicsElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes,
      Pick<PresentationSVGAttributes, 'writing-mode' | 'text-rendering'> {
    x?: Computable<number | string>
    y?: Computable<number | string>
    dx?: Computable<number | string>
    dy?: Computable<number | string>
    rotate?: Computable<number | string>
    textLength?: Computable<number | string>
    lengthAdjust?: Computable<'spacing' | 'spacingAndGlyphs'>
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
    startOffset?: Computable<number | string>
    method?: Computable<'align' | 'stretch'>
    spacing?: Computable<'auto' | 'exact'>
    href?: Computable<string>
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
    x?: Computable<number | string>
    y?: Computable<number | string>
    dx?: Computable<number | string>
    dy?: Computable<number | string>
    rotate?: Computable<number | string>
    textLength?: Computable<number | string>
    lengthAdjust?: Computable<'spacing' | 'spacingAndGlyphs'>
  }
  interface UseSVGAttributes<T>
    extends GraphicsElementSVGAttributes<T>,
      ConditionalProcessingSVGAttributes,
      ExternalResourceSVGAttributes,
      StylableSVGAttributes,
      TransformableSVGAttributes {
    x?: Computable<number | string>
    y?: Computable<number | string>
    width?: Computable<number | string>
    height?: Computable<number | string>
    href?: Computable<string>
  }
  interface ViewSVGAttributes<T>
    extends CoreSVGAttributes<T>,
      ExternalResourceSVGAttributes,
      FitToViewBoxSVGAttributes,
      ZoomAndPanSVGAttributes {
    viewTarget?: Computable<string>
  }
  /**
   * @type {HTMLElementTagNameMap}
   */
  interface HTMLElementTags {
    a: AnchorHTMLAttributes<HTMLAnchorElement>
    abbr: HTMLAttributes<HTMLElement>
    address: HTMLAttributes<HTMLElement>
    area: AreaHTMLAttributes<HTMLAreaElement>
    article: HTMLAttributes<HTMLElement>
    aside: HTMLAttributes<HTMLElement>
    audio: AudioHTMLAttributes<HTMLAudioElement>
    b: HTMLAttributes<HTMLElement>
    base: BaseHTMLAttributes<HTMLBaseElement>
    bdi: HTMLAttributes<HTMLElement>
    bdo: HTMLAttributes<HTMLElement>
    blockquote: BlockquoteHTMLAttributes<HTMLElement>
    body: HTMLAttributes<HTMLBodyElement>
    br: HTMLAttributes<HTMLBRElement>
    button: ButtonHTMLAttributes<HTMLButtonElement>
    canvas: CanvasHTMLAttributes<HTMLCanvasElement>
    caption: HTMLAttributes<HTMLElement>
    cite: HTMLAttributes<HTMLElement>
    code: HTMLAttributes<HTMLElement>
    col: ColHTMLAttributes<HTMLTableColElement>
    colgroup: ColgroupHTMLAttributes<HTMLTableColElement>
    data: DataHTMLAttributes<HTMLElement>
    datalist: HTMLAttributes<HTMLDataListElement>
    dd: HTMLAttributes<HTMLElement>
    del: HTMLAttributes<HTMLElement>
    details: DetailsHtmlAttributes<HTMLDetailsElement>
    dfn: HTMLAttributes<HTMLElement>
    dialog: DialogHtmlAttributes<HTMLDialogElement>
    div: HTMLAttributes<HTMLDivElement>
    dl: HTMLAttributes<HTMLDListElement>
    dt: HTMLAttributes<HTMLElement>
    em: HTMLAttributes<HTMLElement>
    embed: EmbedHTMLAttributes<HTMLEmbedElement>
    fieldset: FieldsetHTMLAttributes<HTMLFieldSetElement>
    figcaption: HTMLAttributes<HTMLElement>
    figure: HTMLAttributes<HTMLElement>
    footer: HTMLAttributes<HTMLElement>
    form: FormHTMLAttributes<HTMLFormElement>
    h1: HTMLAttributes<HTMLHeadingElement>
    h2: HTMLAttributes<HTMLHeadingElement>
    h3: HTMLAttributes<HTMLHeadingElement>
    h4: HTMLAttributes<HTMLHeadingElement>
    h5: HTMLAttributes<HTMLHeadingElement>
    h6: HTMLAttributes<HTMLHeadingElement>
    head: HTMLAttributes<HTMLHeadElement>
    header: HTMLAttributes<HTMLElement>
    hgroup: HTMLAttributes<HTMLElement>
    hr: HTMLAttributes<HTMLHRElement>
    html: HTMLAttributes<HTMLHtmlElement>
    i: HTMLAttributes<HTMLElement>
    iframe: IframeHTMLAttributes<HTMLIFrameElement>
    img: ImgHTMLAttributes<HTMLImageElement>
    input: InputHTMLAttributes<HTMLInputElement>
    ins: InsHTMLAttributes<HTMLModElement>
    kbd: HTMLAttributes<HTMLElement>
    label: LabelHTMLAttributes<HTMLLabelElement>
    legend: HTMLAttributes<HTMLLegendElement>
    li: LiHTMLAttributes<HTMLLIElement>
    link: LinkHTMLAttributes<HTMLLinkElement>
    main: HTMLAttributes<HTMLElement>
    map: MapHTMLAttributes<HTMLMapElement>
    mark: HTMLAttributes<HTMLElement>
    menu: MenuHTMLAttributes<HTMLElement>
    meta: MetaHTMLAttributes<HTMLMetaElement>
    meter: MeterHTMLAttributes<HTMLElement>
    nav: HTMLAttributes<HTMLElement>
    noscript: HTMLAttributes<HTMLElement>
    object: ObjectHTMLAttributes<HTMLObjectElement>
    ol: OlHTMLAttributes<HTMLOListElement>
    optgroup: OptgroupHTMLAttributes<HTMLOptGroupElement>
    option: OptionHTMLAttributes<HTMLOptionElement>
    output: OutputHTMLAttributes<HTMLElement>
    p: HTMLAttributes<HTMLParagraphElement>
    picture: HTMLAttributes<HTMLElement>
    pre: HTMLAttributes<HTMLPreElement>
    progress: ProgressHTMLAttributes<HTMLProgressElement>
    q: QuoteHTMLAttributes<HTMLQuoteElement>
    rp: HTMLAttributes<HTMLElement>
    rt: HTMLAttributes<HTMLElement>
    ruby: HTMLAttributes<HTMLElement>
    s: HTMLAttributes<HTMLElement>
    samp: HTMLAttributes<HTMLElement>
    script: ScriptHTMLAttributes<HTMLElement>
    section: HTMLAttributes<HTMLElement>
    select: SelectHTMLAttributes<HTMLSelectElement>
    slot: HTMLSlotElementAttributes
    small: HTMLAttributes<HTMLElement>
    source: SourceHTMLAttributes<HTMLSourceElement>
    span: HTMLAttributes<HTMLSpanElement>
    strong: HTMLAttributes<HTMLElement>
    style: StyleHTMLAttributes<HTMLStyleElement>
    sub: HTMLAttributes<HTMLElement>
    summary: HTMLAttributes<HTMLElement>
    sup: HTMLAttributes<HTMLElement>
    table: HTMLAttributes<HTMLTableElement>
    tbody: HTMLAttributes<HTMLTableSectionElement>
    td: TdHTMLAttributes<HTMLTableCellElement>
    template: TemplateHTMLAttributes<HTMLTemplateElement>
    textarea: TextareaHTMLAttributes<HTMLTextAreaElement>
    tfoot: HTMLAttributes<HTMLTableSectionElement>
    th: ThHTMLAttributes<HTMLTableCellElement>
    thead: HTMLAttributes<HTMLTableSectionElement>
    time: TimeHTMLAttributes<HTMLElement>
    title: HTMLAttributes<HTMLTitleElement>
    tr: HTMLAttributes<HTMLTableRowElement>
    track: TrackHTMLAttributes<HTMLTrackElement>
    u: HTMLAttributes<HTMLElement>
    ul: HTMLAttributes<HTMLUListElement>
    var: HTMLAttributes<HTMLElement>
    video: VideoHTMLAttributes<HTMLVideoElement>
    wbr: HTMLAttributes<HTMLElement>
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
    'svg:feDropShadow': Partial<SVGFEDropShadowElement>
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
    'svg:mpath': Partial<SVGMPathElement>
    'svg:path': PathSVGAttributes<SVGPathElement>
    'svg:pattern': PatternSVGAttributes<SVGPatternElement>
    'svg:polygon': PolygonSVGAttributes<SVGPolygonElement>
    'svg:polyline': PolylineSVGAttributes<SVGPolylineElement>
    'svg:radialGradient': RadialGradientSVGAttributes<SVGRadialGradientElement>
    'svg:rect': RectSVGAttributes<SVGRectElement>
    'svg:set': Partial<SVGSetElement>
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

  interface IntrinsicElements extends HTMLElementTags, SVGElementTags {}
}
