> **This is a draft of russian talk about Reatom prerequisites and motivation. Lately, I hope, it will be translating to english.**

# Что стоит стейт-менеджер построить

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

## Контент

### Существующие решения: сильные и слабые стороны

> [Remove "Redux itself is very simple"](https://github.com/reduxjs/redux/pull/2950)

- https://github.com/reduxjs/redux
- https://github.com/bowheart/zedux
- https://github.com/mocoding-software/redux-automata
- https://github.com/rematch/rematch
- https://github.com/TinkoffCreditSystems/stapp
- https://github.com/davidkpiano/xstate
- https://github.com/microstates/microstates.js
- https://github.com/calmm-js/kefir.atom
- https://github.com/grammarly/focal
- https://github.com/orientechnologies/orientdb
- https://github.com/oguzgelal/reclare
- https://github.com/cerebral/cerebral
- https://github.com/adamhaile/S
- https://github.com/cerebral/overmind
- https://github.com/mweststrate/remmi
- https://github.com/zerobias/effector

### Exceptions [control] flow

```
Коллеги, помните мы обсуждали вчера ситуацию про менеджмент состояния:

let a
let b = calc(a)
Что делать если мы обновили a но на calc случился exception. Нужно ли сохранить новое значение a или нужно его откатить в этом случае?
Вы выразили мысль о том что логично сохранить новое значение a. Но я вспомнил в чем тут проблема. Если мы сохраняем значение a:
1. Нужно ли оповещать подписчиков?
1.1 Да - в этом случае не понятно что делать с ошибкой из calc. Ее нельзя не выкинуть - это уже совсем не очевидный флоу получается. Ну предположим мы ее выкинем после обхода подписчиков. А если в подписчиках кто-то упадет, что делать? Как нам выбрасывать 2 ошибки?)) В общем тут все крайне не однозначно, для разных ситуаций может потребоваться разное поведние.., так же это может быть совсем не интуитивно.
1.2 Нет - подписчиков оповещать не нужно. Но что если у вас какой-то сайд-эффект завязан на это значение, тогда в следующий апдейт мы получим уже новое значение, а значение сохранившееся при ошибке пропадет. На примере логера каунтера это будет выглядеть так: 0 (инитиал), 1 (инкрементб сайд-эффект), 2 (инкремент, тут ошибка и мы не трогали подписчиков), 3 (инкремент, сайд-эффект в недоумении куда делось “2”).


Как видите чем больше мы разрешаем программе обрабатывать ошибки, тем менее однозначной она становится. Особенно это может быть проблемой, если обрабатывать ли и как ошибки за вас решает библиотека, а не вы.

Поэтому я придерживаюсь позиции, что при падении необходимо останалвивать и откатывать всю ветку вычислений - возможно мы потеряем апдейт какой-то обособленной фичи, но зато мы на 100% можем быть уверены в консистентности своих данных.
```

## Материалы

<!-- https://raw.githubusercontent.com/artalar/blog/master/src/pages/effector-introduction.md -->

- https://wiki2.org/en/Reactive_programming
- http://dist-prog-book.com/chapter/3/message-passing.html
- http://pchiusano.blogspot.com/2010/01/actors-are-not-good-concurrency-model.html
- [The introduction to Reactive Programming you've been missing](https://gist.github.com/staltz/868e7e9bc2a7b8c1f754)
- 
