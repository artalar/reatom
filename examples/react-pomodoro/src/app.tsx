import { reatomTimer } from '@reatom/timer'
import { useAtom, useCtx } from '@reatom/npm-react'
import './app.css'

const pomodoroAtom = reatomTimer()

const Progress = () => {
  const [paused] = useAtom(pomodoroAtom.pauseAtom)
  const [remains] = useAtom((ctx) => (ctx.spy(pomodoroAtom) / 1000).toFixed(1))
  const [progress] = useAtom((ctx) => ctx.spy(pomodoroAtom.progressAtom) * 100)

  return (
    <div
      className="pomodoro"
      style={{
        opacity: paused ? '0.5' : 1,
        background: `linear-gradient(
          90deg,
          tomato 0%,
          tomato ${progress}%,
          transparent ${progress}%
        )`,
      }}
    >
      remains: {remains}
    </div>
  )
}

const Interval = () => {
  const [interval, setInterval] = useAtom(pomodoroAtom.intervalAtom)

  return (
    <label>
      Interval
      <input
        type="range"
        min="100"
        max="1000"
        step="100"
        value={interval}
        onChange={(e) => setInterval(e.currentTarget.valueAsNumber)}
      />
    </label>
  )
}

export const App = () => {
  const ctx = useCtx()
  const [pause, setPause] = useAtom(pomodoroAtom.pauseAtom)

  return (
    <main>
      <Progress />
      <br />
      <button onClick={() => pomodoroAtom.startTimer(ctx, 5 * 60)}>
        Start pomodoro
      </button>
      <br />
      <button onClick={() => pomodoroAtom.startTimer(ctx, 30)}>
        Start break
      </button>
      <br />
      <button onClick={() => pomodoroAtom.stopTimer(ctx)}>Stop</button>
      <br />
      <button onClick={() => setPause((s) => !s)}>
        {pause ? 'Continue' : 'Pause'}
      </button>
      <br />
      <Interval />
    </main>
  )
}
