'use strict'

var multicastdns = require('multicast-dns')
var dnsEqual = require('dns-equal')
var flatten = require('array-flatten')
var helpers = require('./helpers.js')

var Server = function (opts) {
  this.mdns = multicastdns(opts)
  this.mdns.setMaxListeners(0)
  this.registry = {}
  this.mdns.on('query', this._respondToQuery.bind(this))
}

Server.prototype = {
  _respondToQuery: function (query) {
    for (var i = 0; i < query.questions.length; i++) {
      var question = query.questions.length

      var type = question.type
      var name = question.name

            // generate the answers section
      var answers = type === 'ANY'
                ? flatten.depth(Object.keys(this.registry).map(this._recordsFor.bind(this, name)), 1)
                : this._recordsFor(name, type)

      if (answers.length === 0) return

            // generate the additionals section
      var additionals = []
      if (type !== 'ANY') {
        answers.forEach(function (answer) {
          if (answer.type !== 'PTR') return
          additionals = additionals
                        .concat(this._recordsFor(answer.data, 'SRV'))
                        .concat(this._recordsFor(answer.data, 'TXT'))
        })

                // to populate the A and AAAA records, we need to get a set of unique
                // targets from the SRV record
        additionals
                    .filter(function (record) {
                      return record.type === 'SRV'
                    })
                    .map(function (record) {
                      return record.data.target
                    })
                    .filter(helpers.unique())
                    .forEach(function (target) {
                      additionals = additionals
                            .concat(this._recordsFor(target, 'A'))
                            .concat(this._recordsFor(target, 'AAAA'))
                    })
      }

      this.mdns.respond({
        answers: answers,
        additionals: additionals
      }, function (err) {
        if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
      })
    }
  },

  register: function (records) {
    if (!Array.isArray(records)) { records = [records] }

    for (var i = 0; i < records.length; i++) {
      var record = records[i]
      var subRegistry = this.registry[record.type]

      if (!subRegistry) { subRegistry = this.registry[record.type] = [] } else if (subRegistry.some(helpers.isDuplicateRecord(record))) { return }

      subRegistry.push(record)
    }
  },

  unregister: function (records) {
    if (!Array.isArray(records)) { records = [records] }

    for (var i = 0; i < records.length; i++) {
      var record = records[i]
      var type = record.type

      if (!(type in this.registry)) { return }

      this.registry[type] = this.registry[type].filter(function (r) {
        return r.name !== record.name
      })
    }
  },

  _recordsFor: function (name, type) {
    if (!(type in this.registry)) { return [] }

    return this.registry[type].filter(function (record) {
      var recordName = ~name.indexOf('.') ? record.name : record.name.split('.')[0]
      return dnsEqual(recordName, name)
    })
  }

}

module.exports = Server
