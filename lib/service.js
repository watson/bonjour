'use strict'

var os = require('os')
var serviceName = require('multicast-dns-service-types')
var txt = require('mdns-txt')

var TLD = '.local'
var hostname = os.hostname()

var Service = module.exports = function (opts) {
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')
  if (!opts.protocol) throw new Error('Required protocol not given')
  this.name = opts.name || hostname.replace(/\.local\.?$/, '')
  this.type = serviceName.stringify(opts.type, opts.protocol)
  this.host = opts.host || hostname
  this.port = opts.port
  this.fqdn = this.name + '.' + this.type + TLD
  this.txt = opts.txt
  this.published = true
}

Service.prototype.records = function () {
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
