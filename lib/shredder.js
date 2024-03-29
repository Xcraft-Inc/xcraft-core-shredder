'use strict';

const {isImmutable, isIndexed, fromJS, Set} = require('immutable');
const applyChanges = require('./apply-changes.js');
const applyPatches = require('./apply-patches.js');
const pluckPath = require('./pluck-path.js');

const cache = new Map();

class Shredder {
  constructor(initialState, key) {
    this._useLogger = false;
    this._key = key;
    if (Shredder.isShredder(initialState)) {
      this._state = initialState._state;
      return;
    }

    if (!isImmutable(initialState)) {
      this._state = fromJS(initialState || {});
      return;
    }

    this._state = initialState;
  }

  static mutableReducer(mutator) {
    return (state, action) =>
      state.withMutations((mutableState) =>
        mutator(mutableState, action, state)
      );
  }

  static isShredder(value) {
    return value && value._isSuperReaper6000;
  }

  static isImmutable(...args) {
    return isImmutable(...args);
  }

  static isList(value) {
    if (!value) {
      return false;
    }
    if (Shredder.isShredder(value)) {
      return !!value._state['@@__IMMUTABLE_LIST__@@'];
    } else {
      return !!value['@@__IMMUTABLE_LIST__@@'];
    }
  }

  static toImmutable(value) {
    if (!value) {
      return value;
    } else if (value._isSuperReaper6000) {
      return value.state;
    } else if (!isImmutable(value)) {
      return fromJS(value);
    }
    return value;
  }

  static pluck(state, view) {
    return view.reduce((e, path) => {
      if (typeof path === 'string') {
        let value = state.get(path);
        if (value && value.toJS) {
          value = value.toJS();
        }
        e[path] = value;
      } else {
        pluckPath(e, state, path, null);
      }
      return e;
    }, {});
  }

  static withKeyPredicate(...keys) {
    var keySet = Set(keys);
    return function (v, k) {
      return keySet.has(k);
    };
  }

  static _splitter(p) {
    const bracket = p.indexOf('[');
    if (bracket === -1) {
      return [p];
    }
    const i = p.substring(bracket + 1, p.indexOf(']'));
    return [p.substring(0, bracket), `${i}`];
  }

  static _toPath(p) {
    if (p === '') {
      return [];
    }

    let result = cache.get(p);
    if (result) {
      return result;
    }

    if (typeof p !== 'string') {
      p = `${p}`;
    }

    /* Limit cache size to 4096 entries, remove the older */
    if (cache.size >= 4096) {
      const it = cache[Symbol.iterator]();
      cache.delete(it.next().value[0]);
    }

    let bracket = -2;
    let dot = p.indexOf('.');

    if (dot < 0) {
      bracket = p.indexOf('[');
    }

    if (dot < 0 && bracket < 0) {
      result = [p];
      cache.set(p, result);
      return result;
    }

    if (dot !== -1) {
      result = p.split('.');
    } else {
      result = [p];
    }

    if (bracket === -2) {
      bracket = p.indexOf('[');
    }

    if (bracket >= 0) {
      result = result.reduce((newResult, item) => {
        newResult.push(...Shredder._splitter(item));
        return newResult;
      }, []);
    }

    cache.set(p, result);
    return result;
  }

  pick(...keys) {
    return Object.fromEntries(
      this._state.filter(Shredder.withKeyPredicate(...keys)).entries()
    );
  }

  applyChange(path, change) {
    return this.set(
      path,
      applyChanges(this.get(path, []).valueSeq().toArray(), change)
    );
  }

  _clone() {
    const nShredder = new Shredder(this._state);
    nShredder._useLogger = this._useLogger;
    nShredder._logger = this._logger;
    return nShredder;
  }

  get size() {
    return this._state.size;
  }

  get length() {
    return this._state.size;
  }

  get key() {
    return this._key;
  }

  get state() {
    return this._state;
  }

  set state(state) {
    this._state = state;
  }

  get useLogger() {
    return this._useLogger;
  }

  get log() {
    if (this.useLogger && this._logger) {
      return this._logger;
    }
    return {
      verb: () => {},
      info: () => {},
      warn: () => {},
      err: () => {},
      dbg: this._logger ? this._logger.dbg.bind(this._logger) : console.log,
    };
  }

  hashCode(...args) {
    return this._state.hashCode(...args);
  }

  attachLogger(logger) {
    if (logger) {
      this._logger = logger;
    }
  }

  detachLogger() {
    this._logger = null;
  }

  enableLogger() {
    this._useLogger = true;
  }

  disableLogger() {
    this._useLogger = false;
  }

  toJS() {
    return this.state.toJS();
  }

  static fromJS(...args) {
    return fromJS(...args);
  }

  toArray() {
    return this.state.toArray();
  }

  toObject() {
    return this.state.toObject();
  }

  toList() {
    return this.state.toList();
  }

  toSeq() {
    return this.state.toSeq();
  }

  forEach(...args) {
    this.state.forEach(...args);
  }

  map(...args) {
    const nextState = this.state.map(...args);
    if (this.useLogger) {
      this.log.verb(`next state after map: ${this._stateView(nextState)}`);
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  mapEntries(...args) {
    return this.state.mapEntries(...args);
  }

  find(...args) {
    const nextState = this.state.find(...args);

    if (nextState) {
      if (isImmutable(nextState)) {
        const nShredder = this._clone();
        nShredder._state = nextState;
        return nShredder;
      } else {
        return nextState;
      }
    } else {
      return null;
    }
  }

  findIndex(...args) {
    return this.state.findIndex(...args);
  }

  mapKeys(...args) {
    const nextState = this.state.mapKeys(...args);
    if (this.useLogger) {
      this.log.verb(`next state after mapKeys: ${this._stateView(nextState)}`);
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  reduce(...args) {
    return this.state.reduce(...args);
  }

  transform(kSelector, vSelector) {
    let res = {};
    this.state.map((x, i) => {
      res[kSelector(i, x)] = vSelector(i, x);
    });
    return res;
  }

  select(selector) {
    return this.state
      .map((x, i) => {
        return selector(i, x);
      })
      .valueSeq()
      .toArray();
  }

  reverse() {
    const nextState = this.state.reverse();
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  sort(...args) {
    const nextState = this.state.sort(...args);
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  sortBy(...args) {
    const nextState = this.state.sortBy(...args);
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  objectAt(index) {
    return this.state.skip(index).take(1).toObject();
  }

  keyAt(index) {
    return Object.keys(this.objectAt(index))[0];
  }

  toKeyedSeq() {
    return this.state.toKeyedSeq();
  }

  keySeq() {
    return this.state.keySeq();
  }

  valueSeq() {
    return this.state.valueSeq();
  }

  entrySeq() {
    return this.state.entrySeq();
  }

  keys(...args) {
    return this.state.keys(...args);
  }

  values(...args) {
    return this.state.values(...args);
  }

  entries(...args) {
    return this.state.entries(...args);
  }

  getIn(...args) {
    return this.state.getIn(...args);
  }

  concat(path, value) {
    if (arguments.length === 1) {
      value = path;
      path = '';
    }

    if (Shredder.isShredder(value)) {
      value = value.state;
    }
    const list = this.get(path, []).state.concat(value);
    return this.set(path, list);
  }

  push(path, value) {
    if (arguments.length === 1) {
      value = path;
      path = '';
    }

    value = Shredder.toImmutable(value);
    const list = this.get(path, []).state.push(value);
    return this.set(path, list);
  }

  pop(path) {
    const list = this.get(path, []).state.pop();
    return this.set(path, list);
  }

  unpush(path, value) {
    if (arguments.length === 1) {
      value = path;
      path = '';
    }

    value = Shredder.toImmutable(value);
    let list = this.get(path, null);
    if (!list) {
      return this;
    }
    const i = list.state.findIndex((v) =>
      value.equals ? value.equals(v) : v === value
    );
    list = list.state.delete(i);
    return this.set(path, list.valueSeq().toArray());
  }

  clear(path) {
    let list = this.get(path, null);
    if (!list) {
      return this;
    }
    return this.set(path, []);
  }

  move(path, value, beforeValue) {
    let list = this.get(path, null);
    if (!list) {
      return this;
    }
    const index = list.state.findIndex((v) => v === value);
    let beforeIndex = list.state.findIndex((v) => v === beforeValue);
    if (beforeIndex === -1) {
      list = list.state.delete(index).push(value);
      return this.set(path, list.valueSeq().toArray());
    }
    if (index < beforeIndex) {
      // move forward ?
      beforeIndex--; // decrement because delete !
    }
    list = list.state.delete(index).insert(beforeIndex, value);
    return this.set(path, list.valueSeq().toArray());
  }

  has(path) {
    path = this._protectShredderTools(this._pathShredder(path));
    return this.state.hasIn(path);
  }

  isEmpty() {
    return this.state.isEmpty();
  }

  indexOf(...args) {
    return this.state.indexOf(...args);
  }

  every(...args) {
    return this.state.every(...args);
  }

  includes(...args) {
    const isIncluding = this.state.includes(...args);
    if (this.useLogger) {
      this.log.verb(`state is including: ${isIncluding}`);
    }
    return isIncluding;
  }

  equals(other) {
    let isEqual = false;
    if (Shredder.isShredder(other)) {
      isEqual = this.state.equals(other.state);
    } else if (Shredder.isImmutable(other)) {
      isEqual = this.state.equals(other);
    }
    if (this.useLogger) {
      this.log.verb(`state is equals: ${isEqual}`);
    }
    return isEqual;
  }

  filter(...args) {
    const nextState = this.state.filter(...args);
    if (this.useLogger) {
      this.log.verb(`next state after filter: ${this._stateView(nextState)}`);
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  some(...args) {
    return this.state.some(...args);
  }

  last(...args) {
    const nextState = this.state.last(...args);
    if (this.useLogger) {
      this.log.verb(`next state after last: ${this._stateView(nextState)}`);
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  first(...args) {
    const nextState = this.state.first(...args);
    if (this.useLogger) {
      this.log.verb(`next state after first: ${this._stateView(nextState)}`);
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  count() {
    return this.state.count();
  }

  merge(path, value) {
    value = Shredder.toImmutable(value);

    const node = this.get(path, {});
    return this.set(path, node.state.merge(value));
  }

  mergeDeep(path, value) {
    value = Shredder.toImmutable(value);

    const node = this.get(path, {});
    return this.set(path, node.state.mergeDeep(value));
  }

  join(...args) {
    return this.state.join(...args);
  }

  slice(...args) {
    const nextState = this.state.slice(...args);
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  splice(...args) {
    const nextState = this.state.splice(...args);
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  set(path, value) {
    if (path === '' && typeof value !== 'object') {
      throw new Error(`root cannot be set with ${value}`);
    }

    value = Shredder.toImmutable(value);

    path = this._protectShredderTools(this._pathShredder(path));
    const nextState = this._setListFromPath(path, this.state).setIn(
      path,
      value
    );

    if (this.useLogger) {
      this.log.verb(
        `next state after set ${path}: ${this._stateView(nextState)}`
      );
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  get(path, fallbackValue) {
    path = this._protectShredderTools(this._pathShredder(path));
    const value = this.state.getIn(
      path,
      fallbackValue && fromJS(fallbackValue)
    );

    if (isImmutable(value)) {
      const nShredder = this._clone();
      nShredder._state = value;
      return nShredder;
    }

    return value;
  }

  del(path) {
    path = this._protectShredderTools(this._pathShredder(path));
    const nextState = this.state.deleteIn(path);
    if (this.useLogger) {
      this.log.verb(
        `next state after del (${path}): ${this._stateView(nextState)}`
      );
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  delete(path) {
    return this.del(path);
  }

  deleteAll(...args) {
    const nextState = this.state.deleteAll(...args);
    if (this.useLogger) {
      this.log.verb(
        `next state after deleteAll: ${this._stateView(nextState)}`
      );
    }
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  withMutations(mutator) {
    const nextState = this.state.withMutations((mutable) => {
      const sShredder = this._clone();
      sShredder._state = mutable;
      mutator(sShredder);
    });
    const nShredder = this._clone();
    nShredder._state = nextState;
    return nShredder;
  }

  _setListFromPath(path, state) {
    path.forEach((val, i) => {
      if (Number.isInteger(val)) {
        const targetPath = path.slice(0, i);
        if (!isIndexed(state.getIn(targetPath))) {
          state = state.setIn(targetPath, fromJS([]));
        }
      }
    });
    return state;
  }

  _stateView(state) {
    return JSON.stringify(
      state.toJS(),
      (k, v) => (k === 'parent' ? v.id : v),
      2
    );
  }
  _pathShredder(path) {
    if (!Array.isArray(path)) {
      path = Shredder._toPath(path).map((p) => (!isNaN(p) ? parseInt(p) : p));
    }
    return path;
  }

  _protectShredderTools(path) {
    if (path[0] === 'set' || path[0] === 'get') {
      throw new Error(
        `Wow! You just broke your shredder ${path} tool ?! Are you mad?`
      );
    }
    return path;
  }

  toString() {
    this._stateView(this.state);
  }

  [Symbol.iterator]() {
    return this.state[Symbol.iterator]();
  }

  get _isSuperReaper6000() {
    return true;
  }
}

Shredder.applyPatches = applyPatches;

module.exports = Shredder;
