import {AsyncAction, AsyncCtx, reatomAsync} from '@reatom/async'
import {throwReatomError} from '@reatom/core'

export interface ReatomFetchRequestOptions {
	fetch?: (path: string, init: RequestInit) => Promise<Response>
	basePath?: string
	auth?: string
	headers?: HeadersInit
	withCredentials?: boolean
	validateStatus?: (status: number) => boolean | string
	transformRequest?: (body: any, headers: Headers) => any
}

export interface ReatomFetchGetOptions<T = any>
	extends ReatomFetchRequestOptions {
	validate?: (result: T) => boolean | string
}

const globalDefaults = {
	fetch,
	basePath: '',
	withCredentials: false,
	validateStatus: status => status >= 200 && status < 300,
	validate: () => true,
	transformRequest: body => body,
} satisfies ReatomFetchGetOptions<any>

export const createReatomFetch = (defaults: ReatomFetchRequestOptions) => {
	const req = async <T>(
		ctx: AsyncCtx,
		method: 'get' | 'post',
		actionPath: string,
		actionOptions?: ReatomFetchGetOptions<T>,
		body?: T
	) => {
		const options = {
			...globalDefaults,
			...defaults,
			...(actionOptions ?? {}),
		}

		const headers = new Headers(options.headers)

		headers.set('content-type', 'application/json')

		if (options.auth) {
			headers.set('auth', options.auth)
		}

		const init: RequestInit = {
      method,
      headers,
			signal: ctx.controller.signal,
		}

		if (body !== undefined) {
			init.body = JSON.stringify(options.transformRequest(body, headers))
		}

		const resp = await options.fetch(
			actionPath.replace(/^(?!.*\/\/)\/?/, options.basePath + '/'),
			init
		)

		const statusValid = options.validateStatus(resp.status)
		throwReatomError(
			!statusValid,
			(statusValid as string | false) || resp.statusText
		)

		if (method === 'get') {
			const json = await resp.json()
			const jsonValid = options.validate(json)

			throwReatomError(
				!jsonValid,
				(jsonValid as string | false) || 'Response validation failed'
			)

			return json as T
		}
	}

	return Object.assign(
		<T>(path: string, options?: ReatomFetchGetOptions<T>) =>
			reatomAsync(ctx => req(ctx, 'get', path, options) as Promise<T>),
		{
			post: <T>(path: string, options?: ReatomFetchRequestOptions) =>
				reatomAsync(
					(ctx, body: T) =>
						req(ctx, 'post', path, options, body) as Promise<void>
				),
		}
	)
}

export const reatomFetch = createReatomFetch({})
