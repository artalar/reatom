---
title: Let's implement a custom operator
---

> Разберем разработку переиспользуемого оператора withReadyAtom для reatom/async, это интересно!

Let's break down implementation of withReadyAtom for @reatom/async. That'll be cool!

> Откройте и ознакомьтесь с исходниками (https://gist.github.com/artalar/a20af5b96db619377c3463f1bacb07ff)!

Take a look at [source code](https://gist.github.com/artalar/a20af5b96db619377c3463f1bacb07ff).

> Логика простая: атом содержит флаг того что фетчинг был выполнен (хоть как-то). Нужно это для частой контрукции во вьюшке, типа:

The logic is simple: the atom represents a flag meaning that the fetching of data has been done (in one way or another). You can find this useful if you are used to code like the this:

```jsx
if (!ctx.spy(fetchSome.readyAtom)) {
  return <Loading />
}

if (ctx.spy(fetchSome.errorAtom)) {
  return <Error />
}

return <Data />
```


> Базовый pendingAtom здесь не подходит, потому что по умолчанию он 0 == false, а при самом первом заходе на страницу нам нужно показать сразу лоадер и не пытаться стучаться в Data.

Native pendingAtom is not very useful here because it's 0 by default and we'll get a flash of empty content instead of a neat loader during first render.

> Начнем с объявления дженерика, прямо в нем описываем опциональный dataAtom, что бы потом не вешать на обращение к нему ts-ignore. К самому dataAtom обращаемся что бы тригернуть его коннекшен, ведь мы часто пишем onConnect(fetchSome.dataAtom, fetchSome). Если конекшен не трегирнуть мы застрянем в бесконечном лоадинге начального состояния.

Let's start by defining a generic variable which should have optional dataAtom. Otherwise we'll have to use @ts-ignore to access this atom. We need this atom to trigger a connection (take a look at usual pattern of onConnect(fetchSome.dataAtom, fetchSome)). Without this we'll never touch dataAtom thus never trigger fetch and stuck in forever-loading state.

> Далее мы спаим pendingAtom, но используем его значение только если это не первое чтение readyAtom, тогда показываем начальное состояние.

Then let's spy on pendingAtom but we use it's value only the second and following reads of readAtom. If it's a first read we just show initial state.

> Далее самое интересное, но не совсем очевидное. Мы вешаем onChange, на атом который спаили, причем в колбеке ничего не обновляем, просто читаем значение в никуда. Логика тут, на самом деле, присутствует и вытекает из того как атомы инвалидируются, а так же их ленивости.

And here we get to an interesting but tricky part. We set onChange on the atom we just have spied but we don't do anything with this changed value. This trick is needed because of the way atoms get invalidated and because atoms are lazy by default.

> Когда вы используете spy и читаете / подписываетесь на атом, реатом гарантирует мгновенную инвалидацию состояния этого атома, причем эффективную за счет кучки подкапотных кешей. Это значит, что при обновлении pendingAtom все атомы которые его спаят мгновенно становятся не актуальными и будут пересчитаны по требованию.

When you do spy (read and subscribe) on an atom, reatom guarantees you immediate invalidation of the atom. Meaning when you change pendingAtom every atom spying on it will get invalidated and recalculated when you need their value.

> Важно понять, что если вы попытаетесь реализовать подобную логику на onChange, сделав readyAtom простым AtomMut<boolean> без компьютеда, в редких случаях у вас может получиться написать такой код, в котором вы читаете readyAtom после обновления pendingAtom, но до вызова onChange хука, т.е. вы получите не актуальное состояние.

Note if you try to implement similar behaviour only using onChange, making readyAtom a simple AtomMut<boolean> without computed bindings, you may get intermediate invalid state when you have pendingAtom already changed but onChange not yet triggered.

> Использование spy гарантирует вам получение только актуального состояния. Но зачем тогда читать readyAtom в pendingAtom.onChange? Дело в том что наш computed не совсем чистая функция, с точки зрения нашей системы, т.к. он зависит от state, который НЕ идемпотентный, учитывая инициализацию как сайд-эффект. Поэтому, для гарантии синхронизации readyAtom и pendingAtom нам нужно инициализировать readyAtom тогда же когда и pendingAtom.

When you use spy you are guaranteed to get actual state. But why we need to read readyAtom in onChange(pendingAtom)? Because our computed function is not a pure function since it depends on a state which is initialized as side-effect. So to be sure to have readyAtom and pendingAtom in sync we initialize readyAtom when we have pendingAtom.

> Надеюсь, понятно объяснил 🙂

[Original post in Russian](https://t.me/reatom_ru_news/249).

