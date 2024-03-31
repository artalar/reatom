# Reatom notifications example

This example perfectly illustrates the benefits of [atomization](https://www.reatom.dev/guides/atomization/) and reusability within the Reatom ecosystem - [reatom/timer](https://www.reatom.dev/package/timer/).

- **Domain-Oriented Code**: You don't need to normalize data, store states in separate lists, select and modify them by IDs. Instead, you can describe the entire logic in one factory, making it safer to create instances of your models. This significantly reduces and simplifies the code. While you can use classes, I prefer factories.
- **Isolated States**: Since states are highly isolated into atoms, they are also easy to use in the view layer. Take a look at App.tsx for an example.
- **Versatile Use**: reatom/timer is not limited to [Pomodoro demos](https://github.com/artalar/reatom/tree/v3/examples/react-pomodoro), it can be used to manage the progress of just about anything. It comes with settings for update frequency and pause control out of the box.
- **A Nice Bonus**: The essence of atomization lies in state isolation, which is more performance-optimized compared to managing elements by recreating lists in Redux and Effector.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/artalar/reatom/tree/v3/examples/react-notifications)
