'use strict'

var flatten = require('array-flatten')
var Service = require('./Service.js')
var Prober = require('./Prober.js')

var Registry = function (server) {
  this._server = server
  this._services = []
}

Registry.prototype = {

  publish: function (opts) {
    opts = opts || {}
    var service = new Service(opts)
    service.on('service-publish', this._onServicePublish.bind(this))
    service.on('service-unpublish', this._onServiceUnpublish.bind(this))
    service.on('service-announce-request', this._onAnnounceRequest.bind(this))
    service.on('service-packet-change', this._onServiceChange.bind(this))
    service.start()
    return service
  },

  unpublishAll: function (cb) {
    this._tearDown(this._services, cb)
    this._services = []
  },

  destroy: function () {
    for (var i = 0; i < this._services.length; i++) { this._services[i].destroy() }
  },

    /**
     * Stop the given services
     *
     * Besides removing a service from the mDNS registry, a "goodbye"
     * message is sent for each service to let the network know about the
     * shutdown.
     */
  _tearDown: function (services, cb) {
    if (!Array.isArray(services)) { services = [services] }

    services = services.filter(function (service) {
      return service._activated // ignore services not currently starting or started
    })

    var records = flatten.depth(services.map(function (service) {
      service.deactivate()
      var records = service._records()
      records.forEach(function (record) {
        record.ttl = 0 // prepare goodbye message
      })
      return records
    }), 1)

    if (records.length === 0) { return cb && cb() }

    this._server.unregister(records)

    this._server.mdns.respond(records, this._onTearDownComplete.bind(this, services, cb))
  },

  _onTearDownComplete: function (services, cb) {
    for (var i = 0; i < services.length; i++) { services[i].published = false }

    if (cb) { cb.apply(null, Array.prototype.slice.call(arguments, 2)) }
  },

  _onServiceChange: function (oldPackets) {
    this._server.unregister(oldPackets)
  },

    /**
     * Initial service announcement
     *
     * Used to announce new services when they are first registered.
     *
     * Broadcasts right away, then after 3 seconds, 9 seconds, 27 seconds,
     * and so on, up to a maximum interval of one hour.
     */
  _onAnnounceRequest: function (packet, cb) {
    this._server.register(packet)
    this._server.mdns.respond(packet, cb)
  },

  _onServiceUnpublish: function (service, cb) {
    var index = this._services.indexOf(service)

    this._tearDown(service, cb)

    if (index !== -1) { this._services.splice(index, 1) }
  },

  _onServicePublish: function (service) {
    this._services.push(service)

    if (service.probe) { (new Prober(this._server.mdns, service, this._onProbeComplete.bind(this, service))).start() } else { service.announce() }
  },

  _onProbeComplete: function (service, exists) {
    if (!exists) { return service.announce() }

        // Handle error
    service.stop()
    service.emit('error', new Error('Service name is already in use on the network'))
  }

}

module.exports = Registry
