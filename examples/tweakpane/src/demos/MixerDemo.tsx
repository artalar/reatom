import {
  abortVar,
  action,
  atom,
  computed,
  peek,
  withLocalStorage,
  withSearchParams,
  wrap,
} from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'

import { Pre } from '../components/Pre'
import {
  reatomPaneFolder,
  withBinding,
  withButton,
  withEffect,
} from '../tweakpane'

export const MixerDemo = reatomFactoryComponent(() => {
  const storagePrefix = 'tweakpane.mixer'

  // Folders
  const mainFolder = reatomPaneFolder({ title: 'Audio Mixer' }).extend(
    withEffect((folder) => {
      peek(folder).title = `Audio Mixer (${status()}, ${isAdvanced() ? 'Advanced' : 'Simple'})`
    }),
  )

  const advancedFolder = reatomPaneFolder(
    { title: 'Advanced' },
    mainFolder,
  ).extend(
    withEffect((folder) => {
      peek(folder).hidden = !isAdvanced()
    }),
  )

  // Atoms with deep composition: localStorage + searchParams + binding
  const masterVolume = atom(0.7, 'mixer.volume').extend(
    withLocalStorage(`${storagePrefix}.volume`),
    withSearchParams('volume', {
      parse: (v) => (v ? parseFloat(v) : undefined),
      serialize: (v) => (v ?? 0).toFixed(2),
    }),
    withBinding({ label: 'Volume', min: 0, max: 1, step: 0.01 }, mainFolder),
  )

  const muted = atom(false, 'mixer.muted').extend(
    withLocalStorage(`${storagePrefix}.muted`),
    withBinding({ label: 'Muted' }, mainFolder),
  )

  const mode = atom<'simple' | 'advanced'>('simple', 'mixer.mode').extend(
    withLocalStorage(`${storagePrefix}.mode`),
    withSearchParams('mode', {
      parse: (v) => (v === 'advanced' ? 'advanced' : 'simple'),
    }),
    withBinding(
      { label: 'Mode', options: { Simple: 'simple', Advanced: 'advanced' } },
      mainFolder,
    ),
  )

  const balance = atom(0, 'mixer.balance').extend(
    withLocalStorage(`${storagePrefix}.balance`),
    withBinding(
      { label: 'Balance', min: -1, max: 1, step: 0.01 },
      advancedFolder,
    ),
  )

  const frequency = atom(440, 'mixer.frequency').extend(
    withLocalStorage(`${storagePrefix}.frequency`),
    withBinding(
      { label: 'Frequency', min: 20, max: 2000, step: 1 },
      advancedFolder,
    ),
  )

  // Computed values
  const effectiveVolume = computed(
    () => (muted() ? 0 : masterVolume()),
    'mixer.effectiveVolume',
  )

  const status = computed(() => {
    if (muted()) return 'MUTED'
    if (effectiveVolume() > 0.8) return 'LOUD'
    if (effectiveVolume() > 0.3) return 'NORMAL'
    return 'QUIET'
  }, 'mixer.status')

  const isAdvanced = computed(() => mode() === 'advanced', 'mixer.isAdvanced')

  const leftChannel = computed(
    () => effectiveVolume() * Math.max(0, 1 - balance()),
    'mixer.leftChannel',
  )

  const rightChannel = computed(
    () => effectiveVolume() * Math.max(0, 1 + balance()),
    'mixer.rightChannel',
  )

  const reset = action(() => {
    masterVolume.set(0.7)
    muted.set(false)
    balance.set(0)
    frequency.set(440)
  }, 'mixer.reset').extend(withButton({ title: 'Reset' }, mainFolder))

  masterVolume.binding.extend(
    withEffect((binding) => {
      const isMuted = muted()
      const target = peek(binding)
      target.disabled = isMuted
      target.label = isMuted ? 'Volume (muted)' : 'Volume'
    }),
  )

  // This demo has some circular subscription dependencies, so we need to
  // abort them on demo unmount manually
  abortVar.subscribe(() => {
    mainFolder.abort()
    advancedFolder.abort()
    mode.binding.abort()
    masterVolume.binding.abort()
    muted.binding.abort()
    balance.binding.abort()
    frequency.binding.abort()
  })

  return () => (
    <section>
      <h3>Audio Mixer</h3>

      <p style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}>
        Deep composition with <code>withLocalStorage</code>,{' '}
        <code>withSearchParams</code>, and <code>withBinding</code>. Try{' '}
        <a href="?volume=0.7&mode=advanced">?volume=0.7&mode=advanced</a>
      </p>

      <h4>State</h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
        }}
      >
        <Pre label="Volume">{masterVolume().toFixed(2)}</Pre>
        <Pre label="Status">{status()}</Pre>
        <Pre label="Mode">{mode()}</Pre>
        <Pre label="Muted">{muted().toString()}</Pre>
      </div>

      {isAdvanced() && (
        <>
          <h4>Advanced</h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
            }}
          >
            <Pre label="Balance">{balance().toFixed(2)}</Pre>
            <Pre label="Frequency">{frequency()} Hz</Pre>
            <Pre label="Left Channel">{(leftChannel() * 100).toFixed(0)}%</Pre>
            <Pre label="Right Channel">
              {(rightChannel() * 100).toFixed(0)}%
            </Pre>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button onClick={wrap(() => muted.set((v) => !v))}>Toggle Mute</button>
        <button
          onClick={wrap(() => masterVolume.set((v) => Math.min(1, v + 0.1)))}
        >
          Vol +10%
        </button>
        <button
          onClick={wrap(() =>
            mode.set((m: 'simple' | 'advanced') =>
              m === 'simple' ? 'advanced' : 'simple',
            ),
          )}
        >
          Toggle Mode
        </button>
        <button onClick={wrap(() => reset())}>Reset</button>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
        Settings persist to localStorage. Check console for lifecycle logs.
      </p>
    </section>
  )
}, 'MixerDemo')
