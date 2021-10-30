import { setBatchedUpdates } from '@reatom/react'
// @ts-ignore
import RN from 'react-native'

setBatchedUpdates(RN.unstable_batchedUpdates)
