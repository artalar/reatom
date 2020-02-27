---
description: Reatom APIs
---

# API

## Actions

{% tabs %}
{% tab title="JavaScript" %}
```javascript
const update = declareAction()

update(42) // { type: 'action [1]', payload: 42 }
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
const update = declareAction<number>()

update(42) // { type: 'action [1]', payload: 42 }
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
## Title

Description
{% endhint %}



