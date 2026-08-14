import { atom, computed, effect, sleep, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'

import { reatomPaneFolder, withBinding } from '../tweakpane'

export const MonitorDemo = reatomFactoryComponent(() => {
  const monitorFolder = reatomPaneFolder({ title: 'Monitor' })

  // --- Buffer (History) ---
  const bufferAtom = atom(0, '_bufferAtom').extend(
    withBinding(
      {
        label: 'Buffer (Size 5)',
        readonly: true,
        bufferSize: 5,
      },
      monitorFolder,
    ),
  )

  effect(async () => {
    bufferAtom()
    await wrap(sleep(Math.random() * 100))
    bufferAtom.set(Math.random())
  })

  // --- Time (Interval/Polling simulation) ---
  const timeAtom = atom('', '_timeAtom').extend(
    withBinding(
      {
        label: 'Time',
        readonly: true,
        interval: 1000,
      },
      monitorFolder,
    ),
  )

  effect(async () => {
    timeAtom()
    await wrap(sleep(1000))
    timeAtom.set(new Date().toLocaleTimeString())
  })

  // --- Multiline (Logs) ---
  const logState = atom({}, '_logState')
  const logAtom = computed(
    () => JSON.stringify(logState(), null, 2),
    '_logAtom',
  ).extend(
    withBinding(
      {
        label: 'Multiline Log',
        readonly: true,
        multiline: true,
        rows: 4,
        view: 'textarea',
        interval: 500,
      },
      monitorFolder,
    ),
  )

  effect(async () => {
    logAtom()
    await wrap(sleep(500))
    logState.set({
      positive: Math.random() > 0.5,
      value: Math.random().toFixed(4),
    })
  })

  // --- Wave (Graph) & Driver ---
  const waveAtom = atom(0, '_waveAtom').extend(
    withBinding(
      {
        label: 'Wave (Graph)',
        readonly: true,
        view: 'graph',
        min: -1,
        max: +1,
      },
      monitorFolder,
    ),
  )

  let step = 0
  effect(async () => {
    waveAtom()
    await wrap(sleep(10))
    waveAtom.set(Math.sin((step += 0.05)))
  })

  return () => (
    <section>
      <h3>Monitor Bindings</h3>
      <p>This demo shows read-only monitors updated dynamically.</p>
      <div>
        <p>
          <b>Wave:</b> Updates every 10ms.
          <br />
          <b>Buffer:</b> Updates randomly.
          <br />
          <b>Time:</b> Updates with expected clock time.
          <br />
          <b>Log:</b> Shows current state JSON strings.
        </p>
      </div>
    </section>
  )
}, 'MonitorDemo')
