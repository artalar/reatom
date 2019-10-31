import { combine as c } from '@reatom/core'

const countersShape0 = combine({ counter, counterDoubled })
const countersShape1 = combine('myName', { counter, counterDoubled })
const countersShapex = combine(`myName`, { counter, counterDoubled })
const countersShape2 = c({ counter, counterDoubled })
const countersShape3 = c('myName', { counter, counterDoubled })
const countersShapexx = c(`myName`, { counter, counterDoubled })
const countersShape4 = c(['myName'], { counter, counterDoubled })
