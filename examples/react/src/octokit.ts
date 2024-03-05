import { Octokit as OctokitCore } from '@octokit/core'
import { RequestParameters } from '@octokit/core/dist-types/types'
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods'
import { throttling } from '@octokit/plugin-throttling'

const Octokit = OctokitCore.plugin(restEndpointMethods, throttling)

export const octokit = new Octokit({
  throttle: {
    onRateLimit(retryAfter, options, octokit) {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      )

      if (options.request.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onSecondaryRateLimit(retryAfter, options, octokit) {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      )

      if (options.request.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
  },
})

export const withSignal = (signal: AbortSignal): RequestParameters => {
  return {
    request: { signal },
  }
}
