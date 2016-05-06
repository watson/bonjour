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
  var records = [rr_ptr(this), rr_srv(this), rr_txt(this)]
  var self = this
  var networks_list = os.networkInterfaces()
  Object.keys(networks_list).forEach(function (itr_idx, index, arr) { // itr_idx = interface name
    networks_list[itr_idx].forEach(function (itr, index2, arr2) { // for each interface (itr)
      if (itr.internal === false && itr.family === 'IPv4') {
        records.push(rr_a(self, itr.address))
      } else if (itr.internal === false && itr.family === 'IPv6') {
        records.push(rr_aaaa(self, itr.address))
      }
    })
  })
  return records
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

function rr_a (service, ip_address) {
  return {
    name: service.host,
    type: 'A',
    ttl: 120,
    data: ip_address
  }
}

function rr_aaaa (service, ip_address) {
  return {
    name: service.host,
    type: 'AAAA',
    ttl: 120,
    data: ip_address
  }
}
