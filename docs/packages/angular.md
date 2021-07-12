# @reatom/angular

Angular bindings package for [Reatom](https://github.com/artalar/reatom) store.

[![npm](https://img.shields.io/npm/v/@reatom/angular?style=flat-square)](https://www.npmjs.com/package/@reatom/angular)
![npm type definitions](https://img.shields.io/npm/types/@reatom/angular?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/angular?style=flat-square)](https://bundlephobia.com/result?p=@reatom/angular)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

## Install

```
npm i @reatom/angular
```

or

```sh
yarn add @reatom/angular
```

> `@reatom/angular` depends on and works with `@reatom/core`.

## Api

### useAtom

Makes Observables from atom

#### Basic (useAtom)

```ts
const user$ = useAtom(userAtom)
```

#### Depended value by path

```ts
const userName$ = useAtom(userAtom, 'name')
```

### useAction

Binds action with dispatch to the store.

#### Basic (useAction)

```ts
const handleDoSome = useAction(doSome)
```

## Usage

### Step 1. Add to app module

```ts
// app.module.ts

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, NgReatomModule.forRoot()],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(ngReatom: NgReatom) {
    const unsubscribeDevTools = connectReduxDevtools(ngReatom.store, {})
  }
}
```

### Step 2. Use in component

```ts
// app.component.ts

import { useAction, useAtom, requireAtom } from '@reatom/angular'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  public count$ = useAtom(TodoList, 'count')
  public list$ = useAtom(TodoList, 'list')

  public addItem = useAction(addItem)

  private atoms = requireAtom(TodoList)

  constructor(private reatom: NgReatom) {}

  ngOnInit() {
    this.atoms.subscribe()
  }

  ngOnDestroy() {
    this.atoms.unsubscribe()
  }
}
```

```angular2html
<div>
    <ul>
        <li *ngFor="let item of list$ | async">{{item}}</li>
    </ul>
    <div>Count: {{count$ | async}}</div>
    <button (click)="addItem()">Add item</button>
</div>
```

## Usage in lazy loading modules

### Use in feature module

```ts
// feature.module.ts

@NgModule({
  declarations: [FeatureComponent],
  imports: [CommonModule, NgReatomModule.forChild()],
  providers: [],
  bootstrap: [FeatureComponent],
})
export class FeatureModule {}
```

### Use in shared module

```ts
// shared.module.ts

@NgModule({
  declarations: [SharedComponent],
  imports: [CommonModule, NgReatomModule],
  providers: [],
  bootstrap: [SharedComponent],
})
export class SharedModule {}
```
