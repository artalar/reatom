import { setBatchedUpdates } from '@reatom/react'
// @ts-ignore
import ReactDOM from 'react-dom'

setBatchedUpdates(ReactDOM.unstable_batchedUpdates)
