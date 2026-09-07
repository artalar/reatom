---
title: Comparison
description: How Reatom forms compare to React Hook Form, Formik, and other form libraries
---

Legend:

- 🟢 - fully supported
- 🟡 - partial support
- 🔴 - not supported

Bundle size is calculated based on the core API and any other dependencies required for the library to function.
The core API selection is approximate and may not be fully accurate.

<table>
    <thead>
        <tr>
            <th width="150">Feature</th>
            <th width="150">Reatom Form</th>
            <th width="150">
                <a href="https://tanstack.com/form/latest" target="_blank">TanStack Form</a>
            </th>
            <th width="150">
                <a href="https://react-hook-form.com/" target="_blank">React Hook Form</a>
            </th>
            <th width="150">
                <a href="https://formisch.dev/" target="_blank">Formisch <br>(ex Modular Forms)</a>
            </th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Github</td>
            <td>
                <img src="https://img.shields.io/github/stars/reatom/reatom" alt="GitHub Repo stars">
            </td>
            <td>
                <img src="https://img.shields.io/github/stars/tanstack/form" alt="GitHub Repo stars">
            </td>
            <td>
                <img src="https://img.shields.io/github/stars/react-hook-form/react-hook-form" alt="GitHub Repo stars">
            </td>
            <td>
                <img src="https://img.shields.io/github/stars/open-circle/formisch" alt="GitHub Repo stars">
            </td>
        </tr>
        <tr>
            <td>Supported rendering frameworks</td>
            <td>React, Preact, Vue, Solid, Lit, Reatom JSX</td>
            <td>React, Vue, Angular, Solid, Lit</td>
            <td>React</td>
            <td>React, Solid, Vue, Svelte, Qwik, Preact</td>
        </tr>
        <tr>
            <td>Bundle size</td>
            <td>
                <a href="https://bundlejs.com?q=@reatom/core,@reatom/react&treeshake=[{+reatomField,reatomFieldSet,reatomForm,reatomFieldArray+}],[{+reatomComponent,useAtom,bindField+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" target="_blank">
                    <img 
                        src="https://deno.bundlejs.com/badge?q=@reatom/core,@reatom/react&treeshake=[{+reatomField,reatomFieldSet,reatomForm,reatomFieldArray+}],[{+reatomComponent,useAtom,bindField+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" 
                        alt="reatom core and form bundle size"
                    >
                </a>
            </td>
            <td>
                <a href="https://bundlejs.com?q=@tanstack/react-form&treeshake=[{+useStore,useForm,useField,useFieldGroup+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" target="_blank">
                    <img 
                        src="https://deno.bundlejs.com/badge?q=@tanstack/react-form&treeshake=[{+useStore,useForm,useField,useFieldGroup+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" 
                        alt="tanstack form bundle size"
                    >
                </a>
            </td>
            <td>
                <a href="https://bundlejs.com?q=react-hook-form&treeshake=[{+useForm,useFormState,useFormContext,useWatch,watch,useFieldArray,useController,Controller,createFormControl+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" target="_blank">
                    <img 
                        src="https://deno.bundlejs.com/badge?q=react-hook-form&treeshake=[{+useForm,useFormState,useFormContext,useWatch,watch,useFieldArray,useController,Controller,createFormControl+}]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" 
                        alt="react-hook-form bundle size"
                    >
                </a>
            </td>
            <td>
                <a href="https://bundlejs.com?q=valibot,@formisch/react&treeshake=[{+object,string,number,pipe,email,minLength,maxLength+}],[*]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" target="_blank">
                    <img 
                        src="https://deno.bundlejs.com/badge?q=valibot,@formisch/react&treeshake=[{+object,string,number,pipe,email,minLength,maxLength+}],[*]&config={%22esbuild%22:{%22external%22:[%22react%22]}}" 
                        alt="formisch and a part of valibot bundle size"
                    >
                </a>
            </td>
        </tr>
        <tr>
            <td>
                Decoupled form and field models <b>*1</b>
            </td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🔴</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>
                Granular reactivity <b>*2</b>
            </td>
            <td>🟢</td>
            <td>🟢 *2</td>
            <td>🟢 *2</td>
            <td>🟢 *2</td>
        </tr>
        <tr>
            <td>Standard Schema support</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>SSR support</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>Devtools</td>
            <td>🟡 *3</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>Field groups support</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>Highly optimized array fields</td>
            <td>🟢</td>
            <td>🟡 *4</td>
            <td>🟡 *4</td>
            <td>🟡 *4</td>
        </tr>
        <tr>
            <td>Built-in async validation and debounce</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🟡 *5</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>First-class support for dependent fields and reactive validation rules</td>
            <td>🟢</td>
            <td>🟡 *6</td>
            <td>🔴</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>Built-in fields input/output transformers</td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🔴</td>
            <td>🟢</td>
        </tr>
        <tr>
            <td>First-class support for abstract field components</td>
            <td>🟢</td>
            <td>🟢</td>
            <td>🟢 *7</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>First-class support for state persistence and cross-tab sync</td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🔴</td>
            <td>🔴</td>
        </tr>
        <tr>
            <td>Built-in element reference and focus management</td>
            <td>🟢</td>
            <td>🔴</td>
            <td>🟢</td>
            <td>🟡 *8</td>
        </tr>
    </tbody>
</table>

1. _Decoupled form and field models_ - the form or field logic (state, validation, and field dependencies) is fully defined as a standalone entity outside of the UI framework's lifecycle. It indicates whether the entire form/fields/group of fields model can be tested, reused, or binded to another framework without modifying the business logic, leaving the UI layer responsible only for data binding.
2. _Reactivity granularity_ there is limited to static dependency lists, while ideal behavior would involve automatic tracking like in signal-based architectures
3. Only debug logger is available at this moment
4. List implementation may have performance issues when rendering a large number of elements and may be poorly optimized for virtualization
5. No built-in debounce and validation concurrency solution
6. Validators are currently limited to subscribing to the state of other fields or form submission events. However, validation rule reactivity implies the ability to subscribe to any data source to dynamically update the rules.
7. Available only as a separate package `@hookform/lenses`
8. There is a way to programmatically trigger focus on a field, but there is no access to the element reference itself
