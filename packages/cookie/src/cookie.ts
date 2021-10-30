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
  type argsRemove = Parameters<CookieController<T>['remove']>
  type argsSet = Parameters<CookieController<T>['set']>
  return createAtom(
    {
      set: (name: argsSet[0], value: argsSet[1], options?: argsSet[2]) => ({
        name,
        value,
        options,
      }),
      remove: (name: argsRemove[0]) => name,
      _set: (cookieOnSet: Partial<T>) => cookieOnSet,
    },
    ({ onAction, schedule, create, onInit }, cookieState: Partial<T> = {}) => {
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
        newCookie = { ...newCookie }
        delete newCookie[name]
      })
      onInit(() => {
        schedule((dispatch) => {
          dispatch(create('_set', cookie.get()))
          // @ts-ignore
          realTimeCookie.addListener((newCookieFromListener: Partial<T>) => {
            dispatch(create('_set', newCookieFromListener))
          })
        })
      })
      return newCookie
    },
  )
}
