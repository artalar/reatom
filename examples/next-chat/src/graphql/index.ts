import { gqlClientBase } from '~/features/gqlClientBase'
import { getSdk } from './sdk'

const gqlClient = getSdk(gqlClientBase)

export default gqlClient
