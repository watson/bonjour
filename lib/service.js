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
  this.fqdn = this.name + '.' + this.type + TLD
  this.subtypes = opts.subtypes || null
  this.txt = opts.txt || null
  this.published = false

  this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

Service.prototype._records = function () {
  return [rr_ptr(this), rr_srv(this), rr_txt(this)]
}

function rr_ptr (service) {
  return {
    name: service.type + TLD,
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
      target: service.host
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
