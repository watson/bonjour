'use strict'

var os = require('os')
var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('mdns-txt')

module.exports = Service

util.inherits(Service, EventEmitter)

function Service (opts) {
  if (!opts.name) throw new Error('Required name not given')
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')

  this.name = opts.name
  this.protocol = opts.protocol || 'tcp'
  this.type = opts.type || 'http'
  this.host = opts.host || os.hostname()

  // Sometimes the os reported hostname has the parent name on it
  if (this.host.indexOf('.') !== -1) {
    var _parts = this.host.split('.')
    this.host = _parts[0]
    this.parentDomain = opts.parentDomain || _parts[1]
  }

  this.port = opts.port
  this.subtypes = opts.subtypes || []
  this.fqdn = serviceName.stringify({
    instance: this.name,
    name: this.type,
    protocol: this.protocol,
    parentDomain: this.parentDomain
  })
  this.txt = opts.txt || null
  this.published = false

  this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

Service.prototype._records = function () {
  return [rr_ptr(this), rr_srv(this), rr_txt(this)]
}

function rr_ptr (service, subtype) {
  return {
    name: serviceName.stringify({
      name: service.type,
      protocol: service.protocol,
      subtypes: service.subtypes
    }),
    type: 'PTR',
    ttl: 28800,
    data: service.fqdn
  }
}

function rr_srv (service) {
  return {
    name: service.fqdn,
    type: 'SRV',
    ttl: 120,
    data: {
      port: service.port,
      target: service.host + '.' + service.parentDomain
    }
  }
}

function rr_txt (service) {
  return {
    name: service.fqdn,
    type: 'TXT',
    ttl: 4500,
    data: txt.encode(service.txt)
  }
}
