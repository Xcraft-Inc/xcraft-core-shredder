'use strict';

const {isImmutable, isIndexed, fromJS} = require ('immutable');
const _ = require ('lodash');
const Enumerable = require ('ienumerable').default;
const applyChanges = require ('./apply-changes');

class Shredder {
  constructor (initialState, key) {
    this._useLogger = false;
    this._key = key;
    if (!isImmutable (initialState)) {
      this._state = fromJS (Object.assign ({}, initialState));
      return;
    }

    this._state = initialState;
  }

  applyChange (path, change) {
    return this.set (
      path,
      applyChanges (this.get (path, []).linq.toList (), change)
    );
  }

  _clone () {
    const nShredder = new Shredder (this._state);
    nShredder._useLogger = this._useLogger;
    nShredder._logger = this._logger;
    return nShredder;
  }

  get key () {
    return this._key;
  }

  get linq () {
    return Enumerable.from (this.select ((i, v) => v));
  }

  get shrinq () {
    return Enumerable.from (
      this.select ((i, v) => {
        const e = {key: i, value: v};
        return e;
      })
    ).select (e => new Shredder (e.value, e.key));
  }

  get state () {
    return this._state;
  }

  set state (state) {
    this._state = state;
  }

  get useLogger () {
    return this._useLogger;
  }

  get log () {
    if (this.useLogger && this._logger) {
      return this._logger;
    }
    return {
      verb: () => {},
      info: () => {},
      warn: () => {},
      err: () => {},
    };
  }

  attachLogger (logger) {
    if (logger) {
      logger.verb ('Logger attached!');
      this._logger = logger;
    }
  }

  detachLogger () {
    this._logger = null;
  }

  enableLogger () {
    this._useLogger = true;
  }

  disableLogger () {
    this._useLogger = false;
  }

  toJS () {
    return this.state.toJS ();
  }

  toArray () {
    return this.state.toArray ();
  }

  forEach (...args) {
    this.state.forEach (...args);
  }

  applyForm (value) {
    let newEntity = this.get ('');
    Object.keys (value).forEach (name => {
      if (name !== '$form') {
        if (this.has (name)) {
          const fields = new Shredder (value[name]).shrinq;
          fields.where (item => item.key !== '$form').forEach (item => {
            const fieldPath = `${name}.${item.key}`;
            const existingField = this.get (fieldPath, null);
            if (existingField !== null) {
              let newValue = item.get ('value');

              // Some hacks:
              // Convert to empty string null values
              // Check for empty date too
              if (newValue === null) {
                newValue = '';
                if (existingField === '0001-01-01') {
                  newValue = existingField;
                }
              }

              newEntity = newEntity.set (fieldPath, newValue);
            }
          });
        }
      }
    });
    return newEntity;
  }

  map (...args) {
    return this.state.map (...args);
  }

  transform (kSelector, vSelector) {
    let res = {};
    this.state.map ((x, i) => {
      res[kSelector (i, x)] = vSelector (i, x);
    });
    return res;
  }

  select (selector) {
    return this.state
      .map ((x, i) => {
        return selector (i, x);
      })
      .toArray ();
  }

  reverse () {
    const nextState = this.state.reverse ();
    const nShredder = this._clone ();
    nShredder._state = nextState;
    return nShredder;
  }

  sort (...args) {
    const nextState = this.state.sort (...args);
    const nShredder = this._clone ();
    nShredder._state = nextState;
    return nShredder;
  }

  objectAt (index) {
    return this.state.skip (index).take (1).toObject ();
  }

  keyAt (index) {
    return Object.keys (this.objectAt (index))[0];
  }

  toKeyedSeq () {
    return this.state.toKeyedSeq ();
  }

  getIn (...args) {
    return this.state.getIn (...args);
  }

  push (path, value) {
    const list = this.get (path, []);
    return list.state.push (value);
  }

  unpush (path, value) {
    const list = this.get (path, null);
    if (!list) {
      return list;
    }
    const i = list.state.findIndex (v => v === value);
    return list.state.delete (i);
  }

  has (...args) {
    return this.state.has (...args);
  }

  includes (...args) {
    const isIncluding = this.state.includes (...args);
    if (this.useLogger) {
      this.log.verb (`state is including: ${isIncluding}`);
    }
    return isIncluding;
  }

  equals (other) {
    const isEqual = this.state.equals (other.state);
    if (this.useLogger) {
      this.log.verb (`state is equals: ${isEqual}`);
    }
    return isEqual;
  }

  filter (...args) {
    const nextState = this.state.filter (...args);
    if (this.useLogger) {
      this.log.verb (`next state after filter: ${this._stateView (nextState)}`);
    }
    const nShredder = this._clone ();
    nShredder._state = nextState;
    return nShredder;
  }

  count () {
    return this.state.count ();
  }

  merge (path, value) {
    const node = this.get (path, {});
    return this.set (path, node.state.mergeDeep (fromJS (value)));
  }

  set (path, value) {
    path = this._protectShredderTools (this._pathShredder (path));
    const nextState = this._setListFromPath (path, this.state).setIn (
      path,
      fromJS (value)
    );

    if (this.useLogger) {
      this.log.verb (
        `next state after set ${path}: ${this._stateView (nextState)}`
      );
    }
    const nShredder = this._clone ();
    nShredder._state = nextState;
    return nShredder;
  }

  get (path, fallbackValue) {
    path = this._protectShredderTools (this._pathShredder (path));
    let value;
    if (fallbackValue) {
      value = this.state.getIn (path, fromJS (fallbackValue));
    } else {
      value = this.state.getIn (path);
    }

    if (isImmutable (value)) {
      const nShredder = this._clone ();
      nShredder._state = value;
      return nShredder;
    }

    return value;
  }

  del (path) {
    path = this._protectShredderTools (this._pathShredder (path));
    const nextState = this.state.deleteIn (path);
    if (this.useLogger) {
      this.log.verb (
        `next state after del (${path}): ${this._stateView (nextState)}`
      );
    }
    const nShredder = this._clone ();
    nShredder._state = nextState;
    return nShredder;
  }

  _setListFromPath (path, state) {
    path.forEach ((val, i) => {
      if (Number.isInteger (val)) {
        const targetPath = path.slice (0, i);
        if (!isIndexed (state.getIn (targetPath))) {
          state = state.setIn (targetPath, fromJS ([]));
        }
      }
    });
    return state;
  }

  _stateView (state) {
    return JSON.stringify (
      state.toJS (),
      (k, v) => (k === 'parent' ? v.id : v),
      2
    );
  }
  _pathShredder (path) {
    if (!Array.isArray (path)) {
      path = _.toPath (path).map (p => (!isNaN (p) ? parseInt (p) : p));
    }
    return path;
  }

  _protectShredderTools (path) {
    if (path[0] === 'set' || path[0] === 'get') {
      throw new Error (
        `Wow! You just broke your shredder ${path} tool ?! Are you mad?`
      );
    }
    return path;
  }

  toString () {
    this._stateView (this.state);
  }

  get _isSuperReaper6000 () {
    return true;
  }
}

module.exports = Shredder;
