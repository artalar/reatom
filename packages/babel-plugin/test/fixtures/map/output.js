import { map as m } from '@reatom/core';
const counterDoubled0 = m("counterDoubled0", counter, value => value * 2);
const counterDoubled1 = m('myName', counter, value => value * 2);
const counterDoubledx = m(`myName`, counter, value => value * 2);
const counterDoubled2 = m(['myName'], counter, value => value * 2);
const mapFromArray = [].map(counter, value => value * 2);
const counterDoubled3 = map(counter, value => value * 2);