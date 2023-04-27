'use strict';

const {fromJS} = require('immutable');
const patch = require('xcraft-immutablepatch');

/**
 * @param {*} currentState  current state
 * @param {*} prevState state used for the previous patches
 * @param {*} remoteState state providing by the patches
 * @returns {*} the patched state
 */
function applyPatches(currentState, prevState, remoteState) {
  /* warehouse v4 */
  if (!remoteState.patches) {
    return patch(prevState.state, remoteState.state);
  }

  /* warehouse v5 */
  return currentState.withMutations((state) => {
    for (const branch in remoteState.patches) {
      if (remoteState.patches[branch] === false) {
        state.delete(branch);
        continue;
      }
      const _prevState = prevState.get(branch) || fromJS({});
      state.set(branch, patch(_prevState, remoteState.patches[branch]));
    }
  });
}

module.exports = applyPatches;
