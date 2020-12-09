'use strict';

const deepEqual = require('deep-equal');

module.exports = (arr, change) => {
  switch (change.type) {
    case 'remove':
    case 'uninitial': {
      // Remove old values from the array
      if (change.old_offset) {
        arr.splice(change.old_offset, 1);
      } else {
        const index = arr.findIndex((x) => deepEqual(x.id, change.old_val.id));
        if (index === -1) {
          // Programming error. This should not happen
          throw new Error(
            `change couldn't be applied: ${JSON.stringify(change)}`
          );
        }
        arr.splice(index, 1);
      }
      break;
    }
    case 'add':
    case 'initial': {
      // Add new values to the array
      if (change.new_offset) {
        // If we have an offset, put it in the correct location
        arr.splice(change.new_offset, 0, change.new_val);
      } else {
        // otherwise for unordered results, push it on the end
        arr.push(change.new_val);
      }
      break;
    }
    case 'change': {
      // Modify in place if a change is happening
      if (change.old_offset) {
        // Remove the old document from the results
        arr.splice(change.old_offset, 1);
      }
      if (change.new_offset) {
        // Splice in the new val if we have an offset
        arr.splice(change.new_offset, 0, change.new_val);
      } else {
        // If we don't have an offset, find the old val and
        // replace it with the new val
        const index = arr.findIndex((x) => deepEqual(x.id, change.old_val.id));
        if (index === -1) {
          // indicates a programming bug. The server gives us the
          // ordering, so if we don't find the id it means something is
          // buggy.
          throw new Error(
            `change couldn't be applied: ${JSON.stringify(change)}`
          );
        }
        arr[index] = change.new_val;
      }
      break;
    }
    case 'state': {
      // This gets hit if we have not emitted yet, and should
      // result in an empty array being output.
      break;
    }
    default:
      throw new Error(
        `unrecognized 'type' field from server ${JSON.stringify(change)}`
      );
  }
  return arr;
};
