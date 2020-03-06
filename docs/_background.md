> **This is a draft of russian talk about Reatom prerequisites and motivation. Lately, I hope, it will be translating to english.**

# Что стоит стейт-менеджер построить

<!--
## Оглавление

Расскажу что нужно знать при написании своего стейт-менеджера (СТМ).

> Базовые требования: маленький вес, минимальные накладные расходы (производительность), ленивое подключение модулей, переиспользуемость кода, встроенный dependencies injection (DI), автоматический вывод статических типов.

- Существующие решения: сильные и слабые стороны (обзор десятка интереснейших СТМ).
- Какие ограничения накладывает необходимость в transpile-target ES5 и можно ли жить без Proxy.
- Фишки использования иммутабельных структур данных.
- Hight order types (HOT) и вывод типов - почему это не просто.
- Зачем думать о ссылках и garbage collection (GC).
- Можно ли построить простой [публичный] API библиотеки. DX и доступность.
- Может (и должно) ли API библиотеки влиять на всю архитектуру приложения.
- Exceptions [control] flow или что может пойти не так если использовать catch.
- Glitches и фундаментальные проблемы спеки реактивности.
- Теория графов и работа с деревьями в разных условиях: создание и обход.
- Производительность на всех этапах.

> Всякие "мелочи": документация, примеры, ведение проекта, маркетинг.

Будет много отсылок к [Reatom](https://github.com/artalar/reatom), как успешному результату.
-->

### Вступление

> [Спасибо всем контрибьюетрам](https://github.com/artalar/reatom/graphs/contributors)

Иследовать и учится нужно нормально, а не как я.

Стейт-менеджер (СТМ) - реактивная база данных.

Модель - описание структурного типа данных и его зависимостей, применимо как к модулю, так и к всему приложению.

Хороший стейт-менеджер - это хорошие модель-менеджер.

[Задачи стейт-менеджера](https://github.com/artalar/reatom)

### Существующие решения: сильные и слабые стороны

- https://github.com/reduxjs/redux
  > - [Remove "Redux itself is very simple"](https://github.com/reduxjs/redux/pull/2950);
  > - невозможно нормально скейлить - ни в ширину, ни в глубину (из-за проблем с производительностью и отсутствием lazy-loading из коробки);
  > - разделение модели на редусеры и селекторы теоретически хорошо, т.к. селекторы выступают публичным интерфейсом. Но на практике в сложных моделях, т.к. редусеры не могут зависить друг от друга, а селекторы могут - вся логика модели переносится в селекторы и редусеры выступают излишней прослойкой;
  > - результат селектора неиспектабелен (девтулзы);
  > - описывать статическими типами (да и вообще) селекторы не удобно (нужно знать путь к корню);
  > - по умолчанию селекторы и их мемоизация никак не автоматизируются. Из-за этого некоторые могут инлайнить описание модели в совершенно случайных местах, в виде getState().my.value (это сложно рефакторить);
  > - селекторы исполняются после обновления стейта и неправильные данные (установленные в редусерах, которые обычно не имеют рантайм контрактов) могут уронить селектор, но данные остануться в сторе - с этим сложно работать (откатывать, например);
  > - "мидлвары" - спорный паттерн и является чрезмерно гибким и не всегда предсказуемым апи;
  >   часть проблем решается, но решения не стандартизированы, что может влечь еще перечень проблем.
- https://github.com/bowheart/zedux
- https://github.com/zmitry/okdux
- https://github.com/oguzgelal/reclare
- https://github.com/theKashey/restate
- https://github.com/rematch/rematch
- https://github.com/TinkoffCreditSystems/stapp
- https://github.com/mocoding-software/redux-automata
- https://github.com/davidkpiano/xstate
  > бойлерплейтно, хотя недавно презентовали свой DSL
- https://github.com/logux
- https://github.com/tonsky/datascript
- https://github.com/orientechnologies/orientdb

- https://github.com/calmm-js/kefir.atom
- https://github.com/grammarly/focal
- https://github.com/adamhaile/S
- https://github.com/zerkalica/lom_atom
- https://github.com/cerebral/cerebral
- [function-tree](https://www.npmjs.com/package/function-tree) (executor pattern)
- https://github.com/cerebral/overmind
- https://github.com/microstates/microstates.js
- https://github.com/mobxjs/mobx
  > - огромный бандлсайз
  > - предлагает использовать нестандартизированный синтаксис (декораторы)
  > - мутабельный стейт сложнее дебажить
  > - прокси - неявный паттерн, ухудшающий семантику
  > - сложный под капотом, могут быть сложности при написании собственных структур данных
  > - проблема рантайм семантики в том что используемыми зависимостями можно безконтрольно играться. Например, использовать их из di, усложняя анализ (ментальный) связей.
- https://github.com/mweststrate/remmi
- https://github.com/zerobias/effector
  > - стейтфулл сторы мешают переиспользовать "модель" и заставляют думать о утечках памяти
  > - Недекларативное объявление зависимостей и циклические зависимости - это необязательное усложение кода
  > - [Throw in reducer is not cancel computation of other reducers](https://github.com/zerobias/effector/issues/90)
  > - Малый вес библиотеки - это не основной приоритет

### Можно ли сделать современный СТМ без Proxy

Отслеживание изменений - это интересный вопрос, ответ на который зависит от предполагаемого API, архитектуры, среды исполнения и ее возможностей (версия ЯП).

В основном есть два подхода: следить за входящими данными и следить за исходящими данными.

> Например, [Alt.js](http://alt.js.org/) следит за тем что входит, редакс за тем что исходит

Средства:

- Иммутабельность
  - Фундаментальная предсказуемость
  - Не большие накладные расходы
  - Средство отслеживания изменений
    > ["Data Driven UIs, Incrementally" by Yaron Minsky](https://www.youtube.com/watch?v=R3xX37RGJKE)
    >
    > [Seven Implementations of Incremental](https://www.youtube.com/watch?v=G6a5G5i4gQU)
    <!-- пример с http://alt.js.org/ -->
- Proxy
- [Cursor](<https://en.wikipedia.org/wiki/Cursor_(databases)>)
  <!-- pathon -->
- [lens](https://github.com/calmm-js/partial.lenses)
- [optic](https://github.com/calmm-js/partial.lenses#optics)
- [Zipper](https://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf)

### Вывод типов - почему это не просто

<!-- показать пример вывода типов TS'ом в JS -->

[Emulating a 4-Bit Virtual Machine in (TypeScript\JavaScript) (just Types no Script)](https://gist.github.com/acutmore/9d2ce837f019608f26ff54e0b1c23d6e)

[Тайпинги под Map с полным выводом типов](http://www.typescriptlang.org/play/index.html#code/C4TwDgpgBAsgPAaQDRQGoD4oF4oG1loC6A3AFCiRQDiEwcA1igLZQQAewEAdgCYDOsOAEMuIFCJDpMOFu068BuRlACWXAGYQATlABuhKAH49UAFxQuEXdrIVoAEQgAbWhAbNWHbv0ETxoqWwoWS8FPGUJA2NLax1zJnJwaABBHh53PQ85bwF4PygJQJwlFH0oAB8oRxdODKZ0WySoBAgQPjgQ+R880X9JaWDcAAYSRMpUIScAVwh2zpzfXoKAgaZcAEZR0jHoABVZ4HWg+HWUdaH0Hah9vmAAJiDU9LuUO6GUG8PLu2uDgGZHmk4H8UH93r9bndvk1PmCgjQ6CCIcA-tDKJ9zm8gtVXMCPv9LkA)

В выводе сильно помогают кортежи (Tuple) и, конечно, extends и infer. Мне углубится в HOT помогло изучение исходников библиотеки [typescript-tuple](https://github.com/ksxnodemodules/typescript-tuple)

Рекурсия в типах запрещена, но есть хак. Хотя даже с хаком максимальная глубина рекурсии 8.

```ts
type AND<T extends any[]> = {
  step: ((...args: T) => any) extends (x: infer X, ...xs: infer Xs) => any
    ? Xs extends []
      ? X
      : X & AND<Xs>
    : never
  end: never
}[T extends [] ? 'end' : 'step']
// https://github.com/Microsoft/TypeScript/issues/29594#issuecomment-507701193
```

Лично у меня компилятор падал при попытке вывести аккумулирующее дерево

<!-- Вообще иногда страшно описывать какие-то сложные типы. Как-то с минорным обновлением перестал работать ConcatTuple в typescript-tuple -->

### Garbage collection (GC)

- WeakMap плохо полифилятся
- Хранение объектов по строковому ID в хешпаме не гарбаджколектится
- Стейт все равно должен где-то хранится, вопрос будет ли он по дороге собирать ссылки

### API библиотеки, DX и доступность

- Простой и минималистичный апи. Перегрузки VS коллекция методов
- Отсутствие бойлерплейта
- Статические связи
- Jump to defenition
- Вывод статических типов
- Тестирование
- DI

### API библиотеки и архитектура

Flux

детерменированность

Перечень антипатернов:

- динамическое создание или изменение модели
- циклические зависимости
- игнорирование exception flow

### Exceptions [control] flow

[Event VS Intention](https://youtu.be/EDXccfbWZqM)

![Event VS Intention](https://user-images.githubusercontent.com/27290320/65771824-b9552680-e141-11e9-8fb5-c6c8c1c38932.png)

[Problems playback tests](https://github.com/artalar/state-managers-tests/blob/master/src/index.test.js)

### Glitches

![example](https://user-images.githubusercontent.com/27290320/65772693-67150500-e143-11e9-99fe-2b9084196037.png)

> https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx

> https://staltz.com/rx-glitches-arent-actually-a-problem.html

### Теория графов

**Все - это граф**!

- [directed acyclic graph (DAG)](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
- [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)

### Документация, инфраструктура, маркетинг

<!-- TODO: -->

...

> [Спасибо всем контрибьюетрам](https://github.com/artalar/reatom/graphs/contributors)

## Материалы

<!-- https://raw.githubusercontent.com/artalar/blog/master/src/pages/effector-introduction.md -->

- https://wiki2.org/en/Reactive_programming
- http://dist-prog-book.com/chapter/3/message-passing.html
- http://pchiusano.blogspot.com/2010/01/actors-are-not-good-concurrency-model.html
- [The introduction to Reactive Programming you've been missing](https://gist.github.com/staltz/868e7e9bc2a7b8c1f754)

<!-- - стейт редакса - это дерево? (нет, селекторы делают DAG) -->
<!--
- проблема: консистентность очередности подписок и их нотификации
- проблема: react zombie children
- проблема: отписка во время диспатча
- проблема: в снапшоте дублируются данные (у реатома и эффектора, но не редакса)
- апи: получать,но не подписываться на данные
 -->
