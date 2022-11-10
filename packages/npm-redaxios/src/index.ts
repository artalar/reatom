import redaxiosLib, { Options, Response } from 'redaxios'
import { atom, AtomMut } from '@reatom/core'
import { AsyncAction, reatomAsync } from '@reatom/async'

export type RedaxiosOptions = Options

export const reatomRedaxios = (
  options: RedaxiosOptions,
): {
  <Resp = unknown, Options extends void | RedaxiosOptions = void>(
    options: RedaxiosOptions,
    name?: string,
  ): AsyncAction<[options: Options], Response<Resp>>

  // get<Resp = unknown, Params extends void | RedaxiosOptions['params'] = void>(
  //   params?: RedaxiosOptions['params'],
  // ): AsyncAction<[params: Params], Response<Resp>>

  post<Resp = unknown, Body extends void | RedaxiosOptions['body'] = void>(
    body?: RedaxiosOptions['body'],
    name?: string,
  ): AsyncAction<[body: Body], Response<Resp>>

  defaultsAtom: AtomMut<RedaxiosOptions>
} => {
  const defaultsAtom = atom(options)

  // @ts-ignore
  return Object.assign(
    (options: RedaxiosOptions, name = `redaxios[${options.url}]`) =>
      reatomAsync(
        (ctx, _options) =>
          redaxiosLib({
            ...ctx.get(defaultsAtom),
            ...options,
            ..._options,
          }),
        name,
      ),
    {
      post: (body: any, name = `redaxios[${options.url}]`) =>
        reatomAsync(
          (ctx, _body = body) =>
            redaxiosLib({
              ...ctx.get(defaultsAtom),
              ...options,
              body: _body,
            }),
          name,
        ),

      defaultsAtom,
    },
  )
}
