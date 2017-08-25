const deepEqual = require('deep-equal')

module.exports = {

  isDuplicateRecord: function (a) {
    return function (b) {
      return a.type === b.type &&
                a.name === b.name &&
                deepEqual(a.data, b.data)
    }
  },

  unique: function () {
    var set = []
    return function (obj) {
      if (~set.indexOf(obj)) return false
      set.push(obj)
      return true
    }
  }

}
