'use strict'

var multicastdns = require('multicast-dns')
var dnsEqual = require('dns-equal')
var flatten = require('array-flatten')
var deepEqual = require('deep-equal')
var ipRangeCheck = require('ip-range-check')
var os = require('os')

module.exports = Server

function Server (opts) {
  this.mdns = multicastdns(opts)
  this.mdns.setMaxListeners(0)
  this.registry = {}
  this.services = {}
  this.mdns.on('query', this._respondToQuery.bind(this))
}

Server.prototype.register = function (records, service) {
  var self = this

  if (Array.isArray(records)) records.forEach(register)
  else register(records)
  if (service) self.services[service.fqdn] = service

  function register (record) {
    var subRegistry = self.registry[record.type]
    if (!subRegistry) subRegistry = self.registry[record.type] = []
    else if (subRegistry.some(isDuplicateRecord(record))) return
    subRegistry.push(record)
  }
}

Server.prototype.unregister = function (records, service) {
  var self = this

  if (Array.isArray(records)) records.forEach(unregister)
  else unregister(records)
  if (service) delete self.services[service.fqdn]

  function unregister (record) {
    var type = record.type
    if (!(type in self.registry)) return
    self.registry[type] = self.registry[type].filter(function (r) {
      return r.name !== record.name
    })
  }
}

Server.prototype._respondToQuery = function (query, rinfo) {
  var self = this
  query.questions.forEach(function (question) {
    var type = question.type
    var name = question.name

    // generate the answers section
    var answers = self._answersForQuestion(name, type, rinfo)

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

      // to populate the A and AAAA records, we need to get a set of unique
      // targets from the SRV record
      additionals
        .filter(function (record) {
          return record.type === 'SRV'
        })
        .map(function (record) {
          return record.data.target
        })
        .filter(unique())
        .forEach(function (target) {
          additionals = additionals
            .concat(self._addressRecordsForHost(target, 'A', rinfo))
            .concat(self._addressRecordsForHost(target, 'AAAA', rinfo))
        })
    }

    self.mdns.respond({ answers: answers, additionals: additionals }, function (err) {
      if (err) throw err // TODO: Handle this (if no callback is given, the error will be ignored)
    })
  })
}

Server.prototype._answersForQuestion = function (name, type, rinfo) {
  if (type === 'ANY') {
    return flatten.depth(Object.keys(this.registry).map(this._recordsFor.bind(this, name)), 1)
      .concat(this._addressRecordsForHost(name, 'A', rinfo))
      .concat(this._addressRecordsForHost(name, 'AAAA', rinfo))
  }

  if (type === 'A' || type === 'AAAA') {
    return this._addressRecordsForHost(name, type, rinfo)
  }

  return this._recordsFor(name, type)
}

Server.prototype._addressRecordsForHost = function (name, type, rinfo) {
  if (!rinfo || !rinfo.address) return []

  var interfaces = os.networkInterfaces()
  var localAddresses = flatten.depth(Object.keys(interfaces).map(function (interfaceName) {
    return interfaces[interfaceName]
  }), 1)

  var localAddressesByIp = Object.create(null)
  localAddresses.forEach(function (addressInfo) {
    localAddressesByIp[addressInfo.address] = addressInfo
  })

  var records = []
  var self = this

  Object.keys(this.services).forEach(function (fqdn) {
    var service = self.services[fqdn]
    if (!isRecordNameMatch(service.host, name)) return

    getAddressCandidates(service, localAddresses).forEach(function (candidate) {
      var localAddressInfo = localAddressesByIp[candidate.address]
      if (!localAddressInfo || !localAddressInfo.cidr) return
      if (!isRecordTypeFamilyMatch(type, localAddressInfo.family)) return
      if (!ipRangeCheck(rinfo.address, localAddressInfo.cidr)) return

      records.push({
        name: service.host,
        type: type,
        ttl: 120,
        data: localAddressInfo.address
      })
    })
  })

  return uniqueAddressRecords(records)
}

Server.prototype._recordsFor = function (name, type) {
  if (!(type in this.registry)) return []

  return this.registry[type].filter(function (record) {
    return isRecordNameMatch(record.name, name)
  })
}

function isDuplicateRecord (a) {
  return function (b) {
    return a.type === b.type &&
      a.name === b.name &&
      deepEqual(a.data, b.data)
  }
}

function unique () {
  var set = []
  return function (obj) {
    if (~set.indexOf(obj)) return false
    set.push(obj)
    return true
  }
}

function isRecordNameMatch (recordName, name) {
  var normalizedRecordName = ~name.indexOf('.') ? recordName : recordName.split('.')[0]
  return dnsEqual(normalizedRecordName, name)
}

function getAddressCandidates (service, localAddresses) {
  if (Array.isArray(service.addresses)) {
    return service.addresses.map(normalizeAddress).filter(Boolean)
  }

  return localAddresses.filter(function (addressInfo) {
    return !addressInfo.internal
  })
}

function normalizeAddress (address) {
  if (!address) return null
  if (typeof address === 'string') return { address: address }
  if (!address.address) return null
  return address
}

function isRecordTypeFamilyMatch (recordType, family) {
  if (recordType === 'A') return family === 'IPv4' || family === 4
  if (recordType === 'AAAA') return family === 'IPv6' || family === 6
  return false
}

function uniqueAddressRecords (records) {
  var set = Object.create(null)
  return records.filter(function (record) {
    var key = record.type + '::' + record.name + '::' + record.data
    if (set[key]) return false
    set[key] = true
    return true
  })
}
