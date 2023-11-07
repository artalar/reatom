# Reatom comparison with TanStack Query

[Open in StackBlitz](https://stackblitz.com/github/artalar/reatom/tree/v3/examples/tanstack-vs-reatom)

There are four examples files with the equal UI, but different implementation and behavior. Try to run the dev server and play with it. You could find the both base examples code simple and easy to use. TanStack Query is really good solution which is give you a lot right from the box.

But the advanced examples with the more care of the UX contains a few tricky things.

The TanStack Query advanced example shows that:

- `placeholderData` brakes type-inference and produce wrong nullable-types
- there is no way to persist the cache for a specific endpoint and only related queries, it is possible to persist only the last one
- there is no way to store reliable computed data, you need to create additional state and sync it with `useEffect`, which add extra rerender and could produce glitches and unexpected bugs

In other side, Reatom allows you:

- do not write type at all or infer it automatically
- persist related to the specific endpoint cache with correct lifetime and version control
- compute any data anyware and don't thing about race conditions, as the all computations in Reatom has separate queue and appears before effects (subscriptions).

Also, check the page persistance to the search parameters, Reatom allows you to do it much simpler.

## Api setup

You need to generate github developer token to be able to make API calls. Go to https://github.com/settings/tokens, click to "Generate new token" ("Generate new token (classic)"), use "octokit" name (it doesn't meter), no need to enable any options (checkboxes). Copy the generated token and put it to `.env` file like that: `VITE_GITHUB_TOKEN=BHJyG87G_8yg8yVb8YVB9Ubvu1ghvb`
