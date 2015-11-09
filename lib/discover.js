'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('mdns-txt')
var mdns = require('./mdns')

var TLD = '.local'

/**
 * Start a browser
 *
 * The browser listens for services by querying for PTR records of a given
 * type, protocol and domain, e.g. _http._tcp.local.
 *
 * An internal list of online services is kept which starts out empty. When
 * ever a new service is discovered, it's added to the list and an "up" event
 * is emitted with that service. When it's discovered that the service is no
 * longer available, it is removed from the list and a "down" event is emitted
 * with that service.
 */
var Browser = module.exports = function (protocol, type, onup) {
  if (!(this instanceof Browser)) return new Browser(protocol, type, onup)
  if (!type) throw new Error('Required type not given')

  EventEmitter.call(this)

  if (onup) this.on('up', onup)

  this._name = serviceName.stringify(type, protocol) + TLD
  this.services = []

  mdns.on('response', this._onresponse)
  mdns.query(this._name, 'PTR')
}

util.inherits(Browser, EventEmitter)

Browser.prototype.destroy = function () {
  mdns.removeListener('response', this._onresponse)
  this.removeAllListeners()
}

Browser.prototype._onresponse = function (packet) {
  var matches = buildServicesFor(this._name, packet)
  if (matches.length === 0) return

  var exists = {}
  this.services.forEach(function (service) {
    exists[service.fullName] = true
  })

  var self = this
  matches.forEach(function (service) {
    if (exists[service.fullName]) return
    self._addService(service)
  })
}

Browser.prototype._addService = function (service) {
  this.services.push(service)
  this.emit('up', service)
}

function buildServicesFor (name, packet) {
  return packet.answers
    .filter(function (rr) {
      return rr.name === name && rr.type === 'PTR'
    })
    .map(function (ptr) {
      var service = {
        addresses: []
      }

      packet.additionals
        .filter(function (rr) {
          return rr.name === ptr.data && (rr.type === 'SRV' || rr.type === 'TXT')
        })
        .forEach(function (rr) {
          if (rr.type === 'SRV') {
            var parts = rr.name.split('.')
            service.name = parts.shift()
            service.replyDomain = parts.pop()
            service.fullName = rr.name
            service.host = rr.data.target
            service.port = rr.data.port
            service.type = serviceName.parse(parts.join('.'))
          } else if (rr.type === 'TXT') {
            service.rawTxt = rr.data
            service.txt = txt.decode(rr.data)
          }
        })

      packet.additionals
        .filter(function (rr) {
          return rr.name === service.host && (rr.type === 'A' || rr.type === 'AAAA')
        })
        .forEach(function (rr) {
          service.addresses.push(rr.data)
        })

      return service
    })
}
