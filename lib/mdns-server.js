'use strict'

var multicastdns = require('multicast-dns')
var dnsEqual = require('dns-equal')
var flatten = require('array-flatten')

module.exports = Server

function Server (opts) {
  this.mdns = multicastdns(opts)
  this.mdns.setMaxListeners(0)
  this.registry = {}
  this.mdns.on('query', this._respondToQuery.bind(this))
}

Server.prototype.register = function (records) {
  var self = this

  if (Array.isArray(records)) records.forEach(register)
  else register(records)

  function register (record) {
    // TODO: Should the registry be able to hold two records with the
    // same name and type? Or should the new record replace the old?
    var subRegistry = self.registry[record.type]
    if (!subRegistry) subRegistry = self.registry[record.type] = []
    subRegistry.push(record)
  }
}

Server.prototype.unregister = function (records) {
  var self = this

  if (Array.isArray(records)) records.forEach(unregister)
  else unregister(records)

  function unregister (record) {
    var type = record.type
    if (!(type in self.registry)) return
    self.registry[type] = self.registry[type].filter(function (r) {
      return r.name !== record.name
    })
  }
}

Server.prototype._respondToQuery = function (query) {
  var self = this
  query.questions.forEach(function (question) {
    var type = question.type
    var name = question.name

    // generate the answers section
    var answers = type === 'ANY'
      ? flatten.depth(Object.keys(self.registry).map(self._recordsFor.bind(self, name)), 1)
      : self._recordsFor(name, type)

    if (answers.length === 0) return

    // generate the additionals section
    var additionals = []
    if (type !== 'ANY') {
      answers.forEach(function (answer) {
        if (answer.type !== 'PTR') return
        additionals = additionals
          .concat(self._recordsFor(answer.data, 'SRV'))
          .concat(self._recordsFor(answer.data, 'TXT'))
      })
    }

    self.mdns.respond({ answers: answers, additionals: additionals }, function (err) {
      if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
    })
  })
}

Server.prototype._recordsFor = function (name, type) {
  var self = this

  type = type ? [type] : Object.keys(this.registry)

  return flatten.depth(type.map(function (type) {
    if (!(type in self.registry)) return []
    if (name) {
      return self.registry[type].filter(function (record) {
        var _name = ~name.indexOf('.') ? record.name : record.name.split('.')[0]
        return dnsEqual(_name, name)
      })
    } else {
      return self.registry[type]
    }
  }), 1)
}
