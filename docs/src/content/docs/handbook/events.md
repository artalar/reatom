---
title: Events
description: Model events as temporal state — onEvent, filtering, and declarative event flows
---

**Sampling states and events with atoms and actions: The reactive event pattern that will change how you think about data flow!**

I am the author of the Reatom state manager, and today I want to introduce you to one of the most powerful yet underappreciated patterns in reactive programming: sampling states and events using atoms and actions.

While most state managers force you to choose between imperative events or reactive state, Reatom bridges this gap with an elegant unification of both paradigms. This approach provides the clarity of event-driven programming with the consistency of reactive state management.

## The Problem with Traditional Approaches

Traditional state management typically falls into one of two categories:

1. **Event-driven approaches** where events trigger reactive streams (RxJS)
2. **State-driven approaches** where derived values automatically update (MobX, signals)

Each has its strengths, but also critical weaknesses. Event-driven systems need a lot of additional methods to handle complex state properly. Reactive systems with "excel" design fails with event tracking and proper async logic handling.

What if we could have the best of both worlds?

## Actions as Reactive Events: A Core Insight

The key insight of Reatom is treating actions as first-class reactive events that can be both triggered and observed. Let's see a simple example:

```javascript
import { atom, action } from '@reatom/core'

// Create an atom - a state container
const counter = atom(0, 'counter')

// Create an action - a callable function that also works as an event emitter
const increment = action((amount = 1) => {
  counter.set(counter() + amount)
  return counter()
}, 'increment')

// Subscribe to state changes
counter.subscribe((count) => {
  console.log(`Counter is now: ${count}`)
})

// Call the action like a normal function
increment(10) // Counter is now: 10
```

So far, this looks like a typical action pattern. But here's where Reatom's unique perspective shines: **actions themselves are observable reactive entities**. This means you can subscribe to action calls just like you subscribe to atom changes:

```javascript
// Subscribe to action calls
increment.subscribe((calls) => {
  console.log('Counter calls:', ...calls)
})

// Call the action like a normal function
increment()
increment(5)
// To the next tick:
// Counter calls: { params: [], payload: 11 }, { params: [5], payload: 16 }
```

This dual nature of actions as both callable functions and observable events creates a foundation for powerful patterns that are difficult to implement in other libraries.

## The `take` Operator: Awaiting Events Procedurally

One of the most powerful capabilities this enables is the `take` operator. It allows you to wait for specific events or state changes in an asynchronous context, similar to redux-saga's API but with native async/await syntax:

```javascript
import { take, wrap } from '@reatom/core'

const saveUser = action(async () => {
  // Wait for specific user input
  const userData = await wrap(take(submitUserForm))

  // Submit to server
  const response = await wrap(api.saveUser(userData))

  if (response.success) {
    // Wait for form confirmation
    await wrap(take(confirmSave))
    successAtom.set(true)
  }
}, 'saveUser')
```

This allows you to describe complex workflows procedurally while still maintaining a reactive connection to your application's events.

## The Problem with Traditional Event Sampling

In traditional state management, coordinating between events and state often requires complex state machines or tangled subscriptions. Consider this common scenario: you need to listen for an event but access the latest state at the moment the event occurs.

Here's how it might look with traditional approaches:

```javascript
// Redux/traditional approach
const mapStateToProps = (state) => ({
  filters: state.filters,
})

const mapDispatchToProps = (dispatch) => ({
  onSearch: () => {
    // Need to somehow get the current filters here...
    const currentFilters = ???
    dispatch(searchWithFilters(currentFilters))
  }
})
```

Getting access to the current state when an event happens requires convoluted patterns like:

- Storing duplicate state in component
- Creating closure-based references
- Using refs in React
- Complex selector patterns

## Reatom's Solution: Direct State Access

Reatom provides a remarkably clean solution to this problem with direct state access. Within any action or reactive function, you can simply call any atom as a function to get its current value:

```javascript
import { atom, action, computed, wrap } from '@reatom/core'

const filtersAtom = atom({ text: '', category: 'all' }, 'filters')
const resultsAtom = atom([], 'results')

const search = action(async () => {
  // Access any atom's current state directly
  const filters = filtersAtom()

  // Use that state in an API call
  const results = await wrap(searchApi(filters))

  // Update results
  resultsAtom.set(results)
}, 'search')

// Attach to a button in UI
searchButton.addEventListener('click', wrap(search))
```

This eliminates an entire category of state management problems by making any state accessible at the point where it's needed.

## Combining Actions and Atoms with `take`

Now let's see how these concepts come together to create truly elegant solutions to complex problems.

Imagine we're building a form with real-time validation and a submit button that's only enabled when validation passes. Here's how we might approach this with `take` and the action-as-event pattern:

```javascript
import { atom, action, computed, take, wrap } from '@reatom/core'

// Form state atoms
const usernameAtom = atom('', 'username')
const passwordAtom = atom('', 'password')

const isValidAtom = computed(() => {
  const username = usernameAtom()
  const password = passwordAtom()
  return username.length >= 3 && password.length >= 6
}, 'isValid')

// Form actions
const setUsername = action((value) => {
  usernameAtom.set(value)
}, 'setUsername')

const setPassword = action((value) => {
  passwordAtom.set(value)
}, 'setPassword')

const submit = action(async () => {
  // Only proceed if form is valid
  if (!isValidAtom()) {
    return
  }

  const username = usernameAtom()
  const password = passwordAtom()

  // Submit form
  await wrap(api.register({ username, password }))
}, 'submit')

// Now here's where the magic happens - a procedure that coordinates the whole form flow
const formFlowController = action(async () => {
  // Wait until the form becomes valid
  if (!isValidAtom()) {
    await wrap(take(isValidAtom, (isValid, skip) => (isValid ? isValid : skip)))
    console.log('Form is now valid')
  }

  // Wait for the submit button to be clicked
  await wrap(take(submit))
  console.log('Form submitted')

  // Show success message and wait for user acknowledgment
  const showSuccessMessageAtom = atom(false, 'showSuccessMessage')
  showSuccessMessageAtom.set(true)

  // Wait for a specific button click to close the success message
  const closeButton = document.getElementById('closeSuccess')
  await wrap(onEvent(closeButton, 'click'))

  console.log('Flow complete')
}, 'formFlowController')

// Start managing the form
formFlowController()
```

See what happened here? We described a complex form flow with validation, submission, and success handling in a procedural way that's easy to follow, yet it's completely reactive. The code executes in response to events as they occur, without complex nested callbacks or state machine definitions.

## Advanced Pattern: Condition-Based Event Sampling

The `take` function allows for sophisticated filtering with its third parameter. This enables you to wait not just for events, but for events that meet specific criteria:

```javascript
import { wrap, take } from '@reatom/core'

// Wait for a specific navigation event
const routerAtom = atom('/home', 'router')
const destination = await wrap(
  take(routerAtom, (path, skip) => (path === '/dashboard' ? path : skip)),
)

// Wait for a specific form submission
const formDataAtom = atom(null, 'formData')
const validFormData = await wrap(
  take(formDataAtom, (data, skip) => (data?.isValid ? data : skip)),
)
```

This filtering capability eliminates the need for many conditional statements and allows for very declarative descriptions of complex flows.

## Combining Multiple Sources: Racing and Parallel Sampling

Sometimes you need to wait for any one of multiple possible events. Reatom makes this easy with techniques for racing between different events:

```javascript
import { race, take, wrap, sleep } from '@reatom/core'

// Form submission atoms
const formSubmitSuccessAtom = atom(false, 'formSubmitSuccess')
const cancelRequestedAtom = atom(false, 'cancelRequested')

const result = await wrap(
  race({
    success: take(formSubmitSuccessAtom, (value) => value === true),
    cancel: take(cancelRequestedAtom, (value) => value === true),
    timeout: sleep(5000),
  }),
)

if (result.success) {
  // Handle successful submission
} else if (result.cancel) {
  // Handle cancellation
} else if (result.timeout) {
  // Handle timeout
}
```

You can also wait for multiple events to occur in any order:

```javascript
import { all, take, wrap } from '@reatom/core'

// Data loading atoms
const profileLoadedAtom = atom(null, 'profileLoaded')
const preferencesLoadedAtom = atom(null, 'preferencesLoaded')

const [userProfile, userPreferences] = await wrap(
  all([
    take(profileLoadedAtom, (profile) => profile !== null),
    take(preferencesLoadedAtom, (prefs) => prefs !== null),
  ]),
)

// Both have loaded, proceed
```

## Real-world Example: User Auth Flow

Let's bring everything together with a real-world example - an authentication flow that includes login, verification, and redirection:

```javascript
import { atom, action, take, wrap, race, sleep, onEvent } from '@reatom/core'

// Auth state atoms
const userAtom = atom(null, 'user')
const loadingAtom = atom(false, 'loading')
const errorAtom = atom(null, 'error')
const twofaRequiredAtom = atom(false, '2faRequired')

// Login action
const login = action(async (credentials) => {
  return await wrap(api.login(credentials))
}, 'login')

// 2FA verification action
const verify2FA = action(async (userId, code) => {
  return await wrap(api.verify2FA(userId, code))
}, 'verify2FA')

// Authentication flow controller
const authFlow = action(async () => {
  // Create a login form and get reference to its submit button
  const loginForm = document.getElementById('loginForm')
  const submitButton = loginForm.querySelector('button[type="submit"]')

  // Wait for login attempt (when submit button is clicked)
  await wrap(onEvent(submitButton, 'click'))

  // Get form data
  const formData = new FormData(loginForm)
  const credentials = {
    username: formData.get('username'),
    password: formData.get('password'),
  }

  loadingAtom.set(true)

  try {
    // Attempt login
    const user = await wrap(login(credentials))
    userAtom.set(user)

    // If 2FA is required, wait for verification code
    if (user.requires2FA) {
      twofaRequiredAtom.set(true)

      // Get reference to verification form
      const verificationForm = document.getElementById('2faForm')
      const verifyButton = verificationForm.querySelector(
        'button[type="submit"]',
      )

      // Wait for verification submission
      await wrap(onEvent(verifyButton, 'click'))

      // Get verification code
      const verificationCode = document.getElementById('verificationCode').value

      await wrap(verify2FA(user.id, verificationCode))
    }

    // Success! Wait for navigation or timeout
    const result = await wrap(
      race({
        // Wait for a click on any navigation link
        navigation: onEvent(document.querySelector('nav'), 'click'),
        // Or timeout after 3 seconds
        timeout: sleep(3000),
      }),
    )

    // Auto-redirect if user hasn't navigated manually
    if (result.timeout) {
      window.location.href = '/dashboard'
    }
  } catch (error) {
    errorAtom.set(error)

    // Reset after error is acknowledged
    const dismissButton = document.getElementById('dismissError')
    await wrap(onEvent(dismissButton, 'click'))

    errorAtom.set(null)
  } finally {
    loadingAtom.set(false)
  }
}, 'authFlow')

// Start the auth flow controller when the app initializes
document.addEventListener(
  'DOMContentLoaded',
  wrap(() => {
    authFlow()
  }),
)
```

This example shows how Reatom allows you to describe complex, multi-step processes with branching logic in a way that's readable, maintainable, and reactive.

## Benefits Over Traditional Approaches

Compared to other approaches, Reatom's sampling pattern offers significant advantages:

1. **Readability**: Describe complex flows in a procedural style that's easy to follow
2. **Maintainability**: No deeply nested callbacks or complex state machines
3. **Flexibility**: Combine reactive and imperative patterns seamlessly
4. **Type Safety**: Full TypeScript support with excellent inference
5. **Testing**: Easily isolate and test individual steps or entire flows
6. **Concurrency Control**: Built-in handling of race conditions

## Conclusion

The unification of events and state through Reatom's action and atom primitives enables a uniquely powerful approach to managing application state and behavior. By treating actions as reactive events and providing tools like `take` for procedural event sampling, Reatom creates a programming model that's both more expressive and simpler than traditional approaches.

This pattern is especially valuable for:

- Complex user flows and multi-step processes
- Form validation and submission
- Authentication and authorization
- API request coordination
- Animation sequences

Next time you find yourself building complex state logic with multiple steps and conditions, consider how Reatom's event sampling approach might help you create code that's more maintainable and easier to reason about.

The power of reactive events awaits!
