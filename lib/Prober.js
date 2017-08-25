'use strict'

var dnsEqual = require('dns-equal')

/**
 * Check if a service name is already in use on the network.
 *
 * Used before announcing the new service.
 *
 * To guard against race conditions where multiple services are started
 * simultaneously on the network, wait a random amount of time (between
 * 0 and 250 ms) before probing.
 *
 * TODO: Add support for Simultaneous Probe Tiebreaking:
 * https://tools.ietf.org/html/rfc6762#section-8.2
 */

var Prober = function (mdns, service, cb) {
  this.sent = false
  this.retries = 0
  this.timer = null
  this.cb = cb
  this.mdns = mdns
  this.service = service
  this.bound = this.onMDNSresponse.bind(this)
  this.matchRRBound = this.matchRR.bind(this)
}

Prober.prototype = {

  start: function () {
    this.mdns.on('response', this.bound)
    setTimeout(this.try.bind(this), Math.random() * 250)
  },

  try: function () {
        // abort if the service have or is being stopped in the meantime
    if (!this.service._activated || this.service._destroyed) return

    this.mdns.query(this.service.fqdn, 'ANY', function () {
            // This function will optionally be called with an error object. We'll
            // just silently ignore it and retry as we normally would
      this.sent = true
      this.timer = setTimeout(++this.retries < 3 ? this.try.bind(this) : this.done.bind(this, false), 250)
      this.timer.unref()
    }.bind(this))
  },

  matchRR: function (rr) {
    return dnsEqual(rr.name, this.service.fqdn)
  },

  onMDNSresponse: function (packet) {
        // Apparently conflicting Multicast DNS responses received *before*
        // the first probe packet is sent MUST be silently ignored (see
        // discussion of stale probe packets in RFC 6762 Section 8.2,
        // "Simultaneous Probe Tiebreaking" at
        // https://tools.ietf.org/html/rfc6762#section-8.2
    if (!this.sent) { return }

    if (packet.answers.some(this.matchRRBound) || packet.additionals.some(this.matchRRBound)) { this.done(true) }
  },

  done: function (success) {
    this.mdns.removeListener('response', this.bound)
    clearTimeout(this.timer)
    this.cb(success)
  }

}

module.exports = Prober
