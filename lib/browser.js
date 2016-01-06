'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('mdns-txt')

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

  this._type = opts.type
  this._name = serviceName.stringify({
    name: opts.type,
    protocol: opts.protocol || 'tcp',
    subtypes: opts.subtypes
  })
  this._mdns = mdns
  this._onresponse = null
  this.services = []
  this.start()
}

Browser.prototype.start = function () {
  if (this._onresponse) return

  var self = this

  this._onresponse = function (packet) {
    var matches = buildServicesFor(self, packet)
    if (matches.length === 0) return

    var exists = {}
    self.services.forEach(function (service) {
      exists[service.fqdn] = true
    })

    matches.forEach(function (service) {
      if (exists[service.fqdn]) return
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
  this.emit('up', service)
}

function buildServicesFor (browser, packet) {
  var records = packet.answers.concat(packet.additionals)
  return records
    .filter(function (rr) {
      // check the type
      if (rr.type !== 'PTR') {
        return false
      }

      // Check for matching type
      var sn = serviceName.parse(rr.name)
      if (sn.name !== browser._type) {
        return false
      }

      // No match
      return true
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
            var types = serviceName.parse(parts.join('.'))
            service.name = name
            service.fqdn = rr.name
            service.host = rr.data.target
            service.port = rr.data.port
            service.type = types.name
            service.protocol = types.protocol
            service.subtypes = types.subtypes || []
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
