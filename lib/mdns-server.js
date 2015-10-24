'use strict'

var registry = {}

var mdns = require('./mdns')

mdns.on('query', respondToQuery)

exports.register = function (records) {
  if (Array.isArray(records)) records.forEach(register)
  else register(records)

  function register (record) {
    // TODO: Should the registry be able to hold two records with the
    // same name and type? Or should the new record replace the old?
    var subRegistry = registry[record.type]
    if (!subRegistry) subRegistry = registry[record.type] = []
    subRegistry.push(record)
  }
}

exports.unregister = function (records) {
  if (Array.isArray(records)) records.forEach(unregister)
  else unregister(records)

  function unregister (record) {
    var type = record.type
    if (!(type in registry)) return
    registry[type] = registry[type].filter(function (r) {
      return r.name !== record.name
    })
  }
}

function respondToQuery (query) {
  query.questions.forEach(function (question) {
    var type = question.type
    var name = question.name
    var records = type === 'ANY'
      ? flatten(Object.keys(registry).map(recordsFor.bind(null, name))) // TODO: In case of ANY, should the PTR records be the primary records and everything else should be listed as additionals?
      : recordsFor(type, name)

    if (records.length === 0) return

    // TODO: When responding to PTR queries, the additionals array should be
    // populated with the related SRV and TXT records

    mdns.respond(records, function (err) {
      if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
    })
  })
}

function recordsFor (name, type) {
  if (!(type in registry)) return []
  return registry[type].filter(function (record) {
    return record.name === name
  })
}

function flatten (arr) {
  return [].concat.apply.bind([].concat, [])(arr)
}
