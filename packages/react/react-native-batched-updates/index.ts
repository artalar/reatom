// @ts-ignore
import RN from 'react-native'
import { setBatchedUpdates } from '@reatom/react'

setBatchedUpdates(RN.unstable_batchedUpdates)
