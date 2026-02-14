'use strict'

var os = require('os')
var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('dns-txt')()

var TLD = '.local'

module.exports = Service

util.inherits(Service, EventEmitter)

function Service (opts) {
  if (!opts.name) throw new Error('Required name not given')
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')

  this.name = opts.name
  this.protocol = opts.protocol || 'tcp'
  this.type = serviceName.stringify(opts.type, this.protocol)
  this.host = opts.host || os.hostname()
  this.port = opts.port
  this.addresses = opts.addresses
  this.fqdn = this.name + '.' + this.type + TLD
  this.subtypes = opts.subtypes || null
  this.txt = opts.txt || null
  this.published = false

  this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

Service.prototype._records = function () {
  var records = [ rrPtrServices(this), rrPtr(this), rrSrv(this), rrTxt(this) ]

  if (this.subtypes) {
    for (var subtypeIndex = 0; subtypeIndex < this.subtypes.length; subtypeIndex += 1) {
      records.push(rrPtr(this, subtypeIndex))
    }
  }

  var self = this
  if (!this.addresses) {
    var interfaces = os.networkInterfaces()
    Object.keys(interfaces).forEach(function (name) {
      interfaces[name].forEach(function (addr) {
        if (addr.internal) return
        if (addr.family === 'IPv4') {
          records.push(rrA(self, addr.address))
        } else {
          records.push(rrAaaa(self, addr.address))
        }
      })
    })
  } else {
    if (this.addresses.ipv4) {
      this.addresses.ipv4.forEach(function (addr) {
        records.push(rrA(self, addr))
      })
    }
    if (this.addresses.ipv6) {
      this.addresses.ipv6.forEach(function (addr) {
        records.push(rrAaaa(self, addr))
      })
    }
  }

  return records
}

function rrPtrServices (service) {
  return {
    name: '_services._dns-sd._udp.local',
    type: 'PTR',
    ttl: 28800,
    data: service.type + TLD
  }
}

function rrPtr (service, subtypeIndex) {
  return {
    name: (subtypeIndex !== undefined) ? '_' + service.subtypes[subtypeIndex] + '._sub.' +
      service.type + TLD : service.type + TLD,
    type: 'PTR',
    ttl: 28800,
    data: service.fqdn
  }
}

function rrSrv (service) {
  return {
    name: service.fqdn,
    type: 'SRV',
    ttl: 120,
    data: {
      port: service.port,
      target: service.host
    }
  }
}

function rrTxt (service) {
  return {
    name: service.fqdn,
    type: 'TXT',
    ttl: 4500,
    data: txt.encode(service.txt)
  }
}

function rrA (service, ip) {
  return {
    name: service.host,
    type: 'A',
    ttl: 120,
    data: ip
  }
}

function rrAaaa (service, ip) {
  return {
    name: service.host,
    type: 'AAAA',
    ttl: 120,
    data: ip
  }
}
