import ReactDOM from 'react-dom'
import { setBatchedUpdates } from './'

setBatchedUpdates(ReactDOM.unstable_batchedUpdates)
