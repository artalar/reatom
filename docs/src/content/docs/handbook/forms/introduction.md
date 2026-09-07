---
title: Introduction
description: Reatom forms overview — type-safe fields, fieldsets, validation, and submission
---

This is a general form library with a simple focus and validation management.

The form API is designed for the best type-safety and flexibility. Instead of setting up the form state with a single object, each field is created separately, giving you the ability to fine-tune each field perfectly. As the field and its meta statuses are stored in atoms, you can easily combine them, define hooks, and effects to describe any logic you need.

The cherry on the cake is dynamic field management. You don't need to use awkward string-based APIs like `form.${index}.property`. Instead, you work with actual objects that support straightforward interface definitions and seamless interaction at both the type-level and runtime.

The forms API is composed of the following primitives:

- [`reatomField`](/handbook/forms/concepts/field-atom): a simple yet powerful and flexible field model that encapsulates multiple related states and methods
- [`reatomFieldArray`](/handbook/forms/concepts/field-array): a primitive for dynamic field arrays that enables adding, removing, and reordering fields with a linked-list-like data structure
- [`reatomFieldSet`](/handbook/forms/concepts/fieldset): an aggregation primitive that combines multiple fields and manages them collectively
- [`reatomForm`](/handbook/forms/concepts/form): the form primitive itself - combining `reatomFieldSet`, schema-based validation, and submission functionality

By combining these primitives, you can construct form models of any complexity while maintaining framework agnosticism, simplifying testing, and achieving unprecedented levels of performance and flexibility.

In **React/Preact**, bind fields with `bindField` from `@reatom/react` or `@reatom/preact`. In **native JSX** (`@reatom/jsx`), use `<form model={form}>` for submit and loading state attributes, and `model:field={form.fields.x}` on each control — same core model, no extra form API.
