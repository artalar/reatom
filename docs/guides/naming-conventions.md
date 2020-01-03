# Naming Conventions

Naming is a purely subjective thing that should be in the team. In this guide, we just show the established naming schemes that we use ourselves or members of our community.

The basic rule when designing a project is to **stick to consistency** so as not to knock yourself and other teammates off.

## Actions

Through actions, we tell the model about our intentions. For this reason, you should stick to using imperative, present tense for actions names.

**Examples:** `changeEmail`, `setUserName`

## Atoms

For clarity in the documentation we adhere to the following naming style:

- atom name in `camelCase`
- adding postfix `Atom`

**Examples:** `counterAtom`, `usersListAtom`

### Alternative atoms naming

#### PascalCase as the class name

Since atoms are only stateless functions, they can be compared to classes where actions are analogous to methods. When an atom is connected to a store, it can be compared to creating a class instance.

**Examples:** `Counter`, `UsersList`
