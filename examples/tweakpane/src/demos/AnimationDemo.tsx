import {
  action,
  atom,
  type AtomLike,
  effect,
  peek,
  rAF,
  reatomBoolean,
  reatomEnum,
  reatomMediaQuery,
  reatomNumber,
  reatomString,
  withMiddleware,
  wrap,
} from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'

import { hotWrap } from '../hotWrap'
import { reatomPaneTab, withBinding, withButton, withEffect } from '../tweakpane'

const withFixedValue = <T,>(condition: () => boolean, fixedValue: T) =>
  withMiddleware<AtomLike<T>>(() => {
    return (next, ...params) => {
      return condition() ? fixedValue : next(...params)
    }
  })

export const AnimationDemo = reatomFactoryComponent(() => {
  const canvasAtom = atom<HTMLCanvasElement | null>(null, 'canvas')
  const prefersReduced = reatomMediaQuery('(prefers-reduced-motion: reduce)')

  const tabs = reatomPaneTab(['Shape', 'Motion', 'Style'])

  // --- Shape parameters ---
  const shapeType = reatomEnum(
    ['circle', 'square', 'triangle'],
    'shape.type',
  ).extend(withBinding({ label: 'Type' }, tabs.pages[0]))

  const size = reatomNumber(60, 'shape.size').extend(
    withBinding({ label: 'Size', min: 20, max: 150, step: 1 }, tabs.pages[0]),
  )

  const count = reatomNumber(5, 'shape.count').extend(
    withBinding({ label: 'Count', min: 1, max: 12, step: 1 }, tabs.pages[0]),
  )

  // --- Motion parameters ---
  const speed = reatomNumber(1, 'motion.speed').extend(
    withBinding({ label: 'Speed', min: -5, max: 5, step: 0.1 }, tabs.pages[1]),
    withFixedValue(prefersReduced, 0.1),
  )

  const radius = reatomNumber(120, 'motion.radius').extend(
    withBinding(
      { label: 'Orbit Radius', min: 50, max: 200, step: 1 },
      tabs.pages[1],
    ),
  )

  const wobble = reatomNumber(0, 'motion.wobble').extend(
    withBinding({ label: 'Wobble', min: 0, max: 30, step: 1 }, tabs.pages[1]),
  )

  const paused = reatomBoolean(false, 'motion.paused')

  speed.binding.extend(
    withEffect((binding) => {
      const isPaused = paused()
      const target = peek(binding)
      target.disabled = isPaused || prefersReduced()
      target.label = isPaused ? 'Speed (paused)' : 'Speed'
    }),
  )

  // --- Style parameters ---
  const hue = reatomNumber(200, 'style.hue').extend(
    withBinding(
      { label: 'Base Hue', min: 0, max: 360, step: 1 },
      tabs.pages[2],
    ),
  )

  const saturation = reatomNumber(80, 'style.saturation').extend(
    withBinding(
      { label: 'Saturation', min: 0, max: 100, step: 1 },
      tabs.pages[2],
    ),
  )

  const lightness = reatomNumber(55, 'style.lightness').extend(
    withBinding(
      { label: 'Lightness', min: 20, max: 80, step: 1 },
      tabs.pages[2],
    ),
  )

  const trail = reatomNumber(0.5, 'style.trail').extend(
    withBinding({ label: 'Trail', min: 0, max: 1, step: 0.01 }, tabs.pages[2]),
    withFixedValue(prefersReduced, 0),
  )

  const blink = reatomNumber(0, 'style.blink').extend(
    withBinding({ label: 'Blink', min: 0, max: 1, step: 0.01 }, tabs.pages[2]),
  )

  trail.binding.extend(
    withEffect((binding) => {
      peek(binding).disabled = prefersReduced()
    }),
  )

  blink.binding.extend(
    withEffect((binding) => {
      peek(binding).disabled = prefersReduced()
    }),
  )

  const bgColor = reatomString('#050505', 'style.bgColor').extend(
    withBinding({ label: 'Background', color: { type: 'int' } }, tabs.pages[2]),
  )

  const time = reatomNumber(0, 'animation._time')
  effect(() => {
    const { delta } = rAF()
    // always subscribe to ensure binding is created
    const s = speed()
    if (!paused()) {
      time.set((t) => t + (delta / 1000) * s)
    }
  })

  // Canvas render effect
  effect(() => {
    const canvas = canvasAtom()
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const t = time()
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Draw semi-transparent background for trail effect
    // Use power curve for perceptual linearity: 0 = no trail, 1 = max trail
    const bg = bgColor()
    const trailAlpha = Math.pow(1 - trail(), 3)
    ctx.fillStyle =
      bg +
      Math.round(trailAlpha * 255)
        .toString(16)
        .padStart(2, '0')
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const n = count()
    const r = radius()
    const s = size()
    const w = wobble()
    const h = hue()
    const sat = saturation()
    const lit = lightness()
    const shape = shapeType()
    const blinkChance = blink()

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + t
      const wobbleOffset = w * Math.sin(t * 3 + i)
      const x = centerX + Math.cos(angle) * (r + wobbleOffset)
      const y = centerY + Math.sin(angle) * (r + wobbleOffset)

      // Random blink: boost lightness (use cubic curve for gentler effect)
      const isBlink = Math.random() < Math.pow(blinkChance, 3) * 0.3
      const itemLit = isBlink ? Math.min(100, lit + 40) : lit

      // Color varies by index
      const itemHue = (h + (i / n) * 60) % 360
      ctx.fillStyle = `hsl(${itemHue}, ${sat}%, ${itemLit}%)`

      ctx.beginPath()
      if (shape === 'circle') {
        ctx.arc(x, y, s / 2, 0, Math.PI * 2)
      } else if (shape === 'square') {
        ctx.rect(x - s / 2, y - s / 2, s, s)
      } else if (shape === 'triangle') {
        const h = (s * Math.sqrt(3)) / 2
        ctx.moveTo(x, y - (h * 2) / 3)
        ctx.lineTo(x - s / 2, y + h / 3)
        ctx.lineTo(x + s / 2, y + h / 3)
        ctx.closePath()
      }
      ctx.fill()
    }
  }, 'canvasRender')

  const togglePause = action(() => paused.set((p) => !p), 'togglePause').extend(
    withButton({ title: '' }),
  )

  togglePause.button.extend(
    withEffect((button) => {
      peek(button).title = paused() ? 'Resume' : 'Pause'
    }),
  )

  const reset = action(() => {
    shapeType.reset()
    size.reset()
    count.reset()
    speed.reset()
    radius.reset()
    wobble.reset()
    paused.reset()
    hue.reset()
    saturation.reset()
    lightness.reset()
    trail.reset()
    blink.reset()
    bgColor.reset()
    time.reset()
  }, 'reset').extend(withButton({ title: 'Reset All' }))

  return () => (
    <section>
      <h3>Animation Demo</h3>
      <p style={{ marginBottom: '1rem' }}>
        Real-time canvas animation with Tweakpane controls. Tweak parameters and
        see instant visual feedback.
      </p>

      <canvas
        ref={wrap((el) => void canvasAtom.set(el))}
        width={400}
        height={400}
        style={{
          border: '1px solid #333',
          borderRadius: '8px',
          display: 'block',
          marginBottom: '1rem',
        }}
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={hotWrap(togglePause)}>
          {paused() ? 'Resume' : 'Pause'}
        </button>
        <button onClick={hotWrap(reset)}>Reset All</button>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
        Try adjusting Shape, Motion, and Style tabs in the Tweakpane panel.
        Notice how the Speed control becomes disabled when paused.
      </p>
    </section>
  )
}, 'AnimationDemo')
