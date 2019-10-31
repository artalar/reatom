import { declareAction as a } from '@reatom/core';
const myAction0 = a("myAction0");
const myAction1 = a("myAction1", () => {});
const myAction2 = a('notMyAction');
const myAction3 = a(`notMyAction`);
const myAction4 = a('notMyAction', () => {});
const myAction5 = a(`notMyAction`, () => {});
const myAction6 = a(['notMyAction'], () => {});
const myAction7 = declareAction();