// @ts-ignore
import ReactDOM from 'react-dom'
import { setBatchedUpdates } from '@reatom/react'

setBatchedUpdates(ReactDOM.unstable_batchedUpdates)
