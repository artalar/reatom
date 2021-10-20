import { createAtom } from '@reatom/core'
import {
  CookieController,
  CookieObjectModel,
  RealTimeCookie,
} from '@cookie-baker/core'

export const createCookieAtom = <T extends CookieObjectModel>(
  cookie: CookieController<T>,
  realTimeCookie: RealTimeCookie<T>,
) => {
  const init = () => ({ payload: '', type: 'super-uniq' })
  type argsRemove = Parameters<CookieController<T>['remove']>
  type argsSet = Parameters<CookieController<T>['set']>
  return createAtom(
    {
      init,
      set: (name: argsSet[0], value: argsSet[1], options?: argsSet[2]) => ({
        name,
        value,
        options,
      }),
      _set: (cookieOnSet: Partial<T>) => cookieOnSet,
      remove: (name: argsRemove[0]) => name,
    },
    ({ onAction, schedule, create, onInit }, cookieState: Partial<T> = {}) => {
      console.log('reducer')
      let newCookie = cookieState
      onAction('set', ({ name, value, options }) => {
        schedule(() => {
          cookie.set(name, value, options)
        })
        newCookie = { ...newCookie, [name]: value }
      })
      onAction('_set', (cookieOnSet) => {
        newCookie = cookieOnSet
      })
      onAction('remove', (name) => {
        schedule(() => {
          cookie.remove(name)
        })
        newCookie = Object.fromEntries(
          Object.entries(newCookie).filter(([key]) => key !== name),
        ) as T
      })
      onInit(() => {
        schedule((dispatch, ctx) => {
          const handler = () => {
            dispatch(init())
            console.log('dispatch')
            setTimeout(() => {
              console.log('check', ctx.haveSubscribers)
              if (!ctx.haveSubscribers) {
                // @ts-ignore
                realTimeCookie.removeListener(ctx.handler)
                return
              }
              ctx.haveSubscribers = false
              setTimeout(handler, 1000)
            }, 100)
          }
          setTimeout(handler, 1000)
        })
        schedule((dispatch, ctx) => {
          dispatch(create('_set', cookie.get()))
          const handler = (newCookieFromListener: Partial<T>) => {
            dispatch(create('_set', newCookieFromListener))
          }
          // @ts-ignore
          realTimeCookie.addListener(handler)
          ctx.handler = handler
        })
      })
      schedule((dispatch, ctx) => {
        console.log('subscribe true')
        ctx.haveSubscribers = true
      })
      return newCookie
    },
  )
}
