import { reatomComponent } from '@reatom/npm-react'
import { notifications, notify, Notification } from './model'
import './app.css'

const NotificationView = reatomComponent<Notification>(
  ({ ctx, message, kind, timer, remains, readed, remove }) => (
    <li
      className={`notification ${ctx.spy(readed) ? 'notification-readed' : ''}`}
      style={{ background: kind }}
      role="log"
      onClick={() => remove(ctx)}
      onMouseEnter={() => timer.pauseAtom(ctx, true)}
      onMouseLeave={() => timer.pauseAtom(ctx, false)}
    >
      {message}
      <Remains remains={remains} />
    </li>
  ),
  'Notification',
)

const Remains = reatomComponent<{ remains: Notification['remains'] }>(
  ({ ctx, remains }) => (
    <div
      className="remains"
      style={{ '--remains': ctx.spy(remains) + '%' } as any}
    />
  ),
  'Remains',
)

let counter = 0
export const App = reatomComponent(
  ({ ctx }) => (
    <main>
      <button
        onClick={() => {
          notify(ctx, `Message ${++counter}`, 'lightblue')
        }}
      >
        Message
      </button>
      <br />
      <button
        onClick={() => {
          notify(ctx, `Warning ${++counter}`, 'lightyellow')
        }}
      >
        Warning
      </button>
      <ul className="notifications">
        {ctx.spy(notifications).map((notification) => (
          <NotificationView key={notification.id} {...notification} />
        ))}
      </ul>
    </main>
  ),
  'App',
)
