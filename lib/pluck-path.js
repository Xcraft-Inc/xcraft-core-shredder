const setAtPath = (obj, keyPath, value) => {
  const lastKeyIndex = keyPath.length - 1;
  for (var i = 0; i < lastKeyIndex; ++i) {
    const key = keyPath[i];
    if (!(key in obj)) obj[key] = {};
    obj = obj[key];
  }
  obj[keyPath[lastKeyIndex]] = value;
};

const pluckPath = (obj, state, selection, prevPath) => {
  for (const key of Object.keys(selection)) {
    const select = selection[key];
    if (Array.isArray(select)) {
      for (const prop of select) {
        let path = `${prevPath ? `${prevPath}.` : ''}${key}.${prop}`;
        let value = state.get(path);
        if (value.toJS) {
          value = value.toJS();
        }
        setAtPath(obj, path.split('.'), value);
      }
    } else if (select === true) {
      let path = prevPath ? `${prevPath}.${key}` : key;
      let value = state.get(path);
      if (value.toJS) {
        value = value.toJS();
      }
      setAtPath(obj, path.split('.'), value);
    } else {
      pluckPath(obj, state, select, `${prevPath ? `${prevPath}.` : ''}${key}`);
    }
  }
};

module.exports = pluckPath;
