import RN from 'react-native'
import { setBatchedUpdates } from './'

setBatchedUpdates(RN.unstable_batchedUpdates)
