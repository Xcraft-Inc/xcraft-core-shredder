
# Xcraft Shredder

## State management

In a goblin, the `state` is always a shredder:

```js
const logicHandlers = {
  type: (state, action) => {
    return state;
  },
};
```

### Exemple state

If we manage a collection of some entity, 
we encourage to use entity `id` as key:

```js
const exempleCollection = {
  id1: {
    id: 'id1',
    name: 'Shredder 1000',
    version: 1,
    hp: '1000CH',
  },
  id2: {
    id: 'id2',
    name: 'Shredder 2000',
    version: 2,
    hp: '2000CH',
  },
  id3: {
    id: 'id3',
    name: 'Mega Shredder 6000',
    version: 3,
    hp: '6000CH',
  },
}
```

### Set property value

#### state.set (path, value)

If we want set our example as state:

```js
const logicHandlers = {
  create: (state) => {
    return state.set ('', exempleCollection);
  },
  ...
};
```

Note that we use `''` path for indicating the root
of the the state.

Then, in other handlers we can set specific properties,
using `'id.property'` path.

```js
const logicHandlers = {
  ...
  'set-name': (state, action) => {
    const id = action.get ('id');
    const name = action.get ('name');

    return state.set (`${id}.name`, name);
  },
};
```

Tips: use JS template for building the path

### Get property value

#### state.get (path, [optionalfallbackValue])

```js
const nameOfId1 = state.get ('id1.name', null);
```


### Delete property value

#### state.del (path)

If we want delete the full state:

```js
const logicHandlers = {
  delete: (state) => {
    return state.del ('');
  },
  ...
};
```


If we want delete an entry:

```js
const logicHandlers = {
  removeById: (state, action) => {
    const id = action.get ('id');
    return state.del (id);
  },
  ...
};
```


## Using shredder in a widget (React side)


#### this.shred (data)

```js
const person = this.shred (this.props.person);
```


## Linq

Shredder provide the famous IEnumerable API under `linq` property

```js
const names = data
    .linq
    .select (x => x.get ('name'))
    .toList ();

const firstVersion3 = data
        .linq
        .where (x => x.get ('version') === 3)
        .first ();
```

[Link to full API](https://ienumerable.js.org/)
