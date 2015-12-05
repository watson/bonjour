'use strict'

module.exports = flatten

function flatten (arr) {
  return Array.prototype.concat.apply.bind(Array.prototype.concat, [])(arr)
}
