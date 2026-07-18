import { createActor as createKahramanActor } from 'kahraman'

export {
  type ArrayLocator,
  type BaseActor,
  button,
  type DefiniteLocator,
  heading,
  link,
  type Locator,
  role,
  text,
} from 'kahraman'

const clickDelay =
  typeof navigator !== 'undefined' && navigator.webdriver !== true ? 500 : 0
export const createActor = () => createKahramanActor({ clickDelay })
