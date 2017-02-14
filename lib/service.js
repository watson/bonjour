'use strict'

var os = require('os')
var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('dns-txt')()
var net = require('net')

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
  this.fqdn = this.name + '.' + this.type + TLD
  this.subtypes = opts.subtypes || null
  this.txt = opts.txt || null
  this.flush = opts.flush || false
  this.published = false
  this.ip = (function () {
    if (net.isIP(opts.ip) === 4) return { family: 'IPv4', ip: opts.ip }
    if (net.isIP(opts.ip) === 6) return { family: 'IPv6', ip: opts.ip }
    return false
  })()

  this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

Service.prototype._records = function () {
  var records = [rrPtr(this), rrSrv(this), rrTxt(this)]

  var self = this
  if (!this.ip) {
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
    if (this.ip.family === 'IPv4') records.push(rrA(self, this.ip.address))
    if (this.ip.family === 'IPv6') records.push(rrAaaa(self, this.ip.address))
  }

  return records
}

function rrPtr (service) {
  return {
    name: service.type + TLD,
    type: 'PTR',
    ttl: 28800,
    flush: service.flush,
    data: service.fqdn
  }
}

function rrSrv (service) {
  return {
    name: service.fqdn,
    type: 'SRV',
    ttl: 120,
    flush: service.flush,
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
    flush: service.flush,
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
