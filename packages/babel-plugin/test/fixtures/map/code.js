import { map as m } from '@reatom/core'

const counterDoubled0 = m(counter, value => value * 2)
const counterDoubled1 = m('myName', counter, value => value * 2)
const counterDoubledx = m(`myName`, counter, value => value * 2)
const counterDoubled2 = m(['myName'], counter, value => value * 2)
const mapFromArray = [].map(counter, value => value * 2)
const counterDoubled3 = map(counter, value => value * 2)
