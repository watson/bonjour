'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('mdns-txt')

var TLD = '.local'

module.exports = Browser

util.inherits(Browser, EventEmitter)

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
function Browser (mdns, opts, onup) {
  if (!opts.type) throw new Error('Required type not given')

  EventEmitter.call(this)

  if (onup) this.on('up', onup)

  this._name = serviceName.stringify(opts.type, opts.protocol || 'tcp') + TLD
  this._mdns = mdns
  this._onresponse = null
  this._serviceMap = {}
  this.services = []
  this.start()
}

Browser.prototype.start = function () {
  if (this._onresponse) return

  var self = this

  this._onresponse = function (packet) {
    goodbyes(self._name, packet).forEach(self._removeService.bind(self))

    var matches = buildServicesFor(self._name, packet)
    if (matches.length === 0) return

    matches.forEach(function (service) {
      if (self._serviceMap[service.fqdn]) return
      self._addService(service)
    })
  }

  this._mdns.on('response', this._onresponse)
  this._mdns.query(this._name, 'PTR')
}

Browser.prototype.stop = function () {
  if (!this._onresponse) return

  this._mdns.removeListener('response', this._onresponse)
  this._onresponse = null
}

Browser.prototype._addService = function (service) {
  this.services.push(service)
  this._serviceMap[service.fqdn] = true
  this.emit('up', service)
}

Browser.prototype._removeService = function (fqdn) {
  var service, index
  this.services.some(function (s, i) {
    if (s.fqdn === fqdn) {
      service = s
      index = i
      return true
    }
  })
  if (!service) return
  this.services.splice(index, 1)
  this._serviceMap[fqdn] = false
  this.emit('down', service)
}

function goodbyes (name, packet) {
  return packet.answers.concat(packet.additionals)
    .filter(function (rr) {
      return rr.name === name && rr.type === 'PTR' && rr.ttl === 0
    })
    .map(function (rr) {
      return rr.data
    })
}

function buildServicesFor (name, packet) {
  var records = packet.answers.concat(packet.additionals).filter(function (rr) {
    return rr.ttl > 0 // ignore goodbye messages
  })

  return records
    .filter(function (rr) {
      return rr.name === name && rr.type === 'PTR'
    })
    .map(function (ptr) {
      var service = {
        addresses: []
      }

      records
        .filter(function (rr) {
          return rr.name === ptr.data && (rr.type === 'SRV' || rr.type === 'TXT')
        })
        .forEach(function (rr) {
          if (rr.type === 'SRV') {
            var parts = rr.name.split('.')
            var name = parts[0]
            var types = serviceName.parse(parts.slice(1, -1).join('.'))
            service.name = name
            service.fqdn = rr.name
            service.host = rr.data.target
            service.port = rr.data.port
            service.type = types.name
            service.protocol = types.protocol
            service.subtypes = types.subtypes
          } else if (rr.type === 'TXT') {
            service.rawTxt = rr.data
            service.txt = txt.decode(rr.data)
          }
        })

      records
        .filter(function (rr) {
          return rr.name === service.host && (rr.type === 'A' || rr.type === 'AAAA')
        })
        .forEach(function (rr) {
          service.addresses.push(rr.data)
        })

      return service
    })
}
