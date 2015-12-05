'use strict'

var serviceName = require('multicast-dns-service-types')
var Service = require('./service')
var flatten = require('./flatten')

var services = []

var REANNOUNCE_MAX_MS = 60 * 60 * 1000
var REANNOUNCE_FACTOR = 3

exports.publish = function publish (server, opts) {
  if (typeof opts === 'string') {
    opts = serviceName.parse(opts)
    opts.type = opts.name
    opts.port = arguments[2]
    delete opts.name
  }
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')
  if (!opts.protocol) throw new Error('Required protocol not given')

  var service = new Service(opts)
  service.unpublish = function (cb) {
    teardown(server, service, cb)
    var index = services.indexOf(service)
    if (index !== -1) services.splice(index, 1)
  }
  services.push(service)

  // TODO: The RFC allows that probing can be optional if it's know that
  // the name is unique or in some way is already owned by the service (but
  // maybe the class then need to change)
  probe(server, service, function (exists) {
    if (exists) throw new Error('Service name is already in use on the network') // TODO: Handle this. Maybe implement fallback option to auto-increment a number trailing the name
    announce(server, service)
  })

  return service
}

exports.unpublishAll = function (server) {
  teardown(server, services)
  services = []
}

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
function probe (server, service, cb) {
  var sent = false
  var retries = 0
  var timer

  server.mdns.on('response', onresponse)
  setTimeout(send, Math.random() * 250)

  function send () {
    // abort if the service have been unpublished in the meantime
    if (!service.published) return

    server.mdns.query(service.fqdn, 'ANY', function () {
      // This function will optionally be called with an error object. We'll
      // just silently ignore it and retry as we normally would
      sent = true
      timer = setTimeout(++retries < 3 ? send : done, 250)
    })
  }

  function onresponse (packet) {
    // Apparently conflicting Multicast DNS responses received *before*
    // the first probe packet is sent MUST be silently ignored (see
    // discussion of stale probe packets in RFC 6762 Section 8.2,
    // "Simultaneous Probe Tiebreaking" at
    // https://tools.ietf.org/html/rfc6762#section-8.2
    if (!sent) return

    if (packet.answers.some(matchRR) || packet.additionals.some(matchRR)) done(true)
  }

  function matchRR (rr) {
    return rr.name === service.fqdn
  }

  function done (exists) {
    server.mdns.removeListener('response', onresponse)
    clearTimeout(timer)
    cb(!!exists)
  }
}

/**
 * Initial service announcement
 *
 * Used to announce new services when they are first registered.
 *
 * Broadcasts right away, then after 3 seconds, 9 seconds, 27 seconds,
 * and so on, up to a maximum interval of one hour.
 */
function announce (server, service) {
  var delay = 1000
  var packet = service.records()

  server.register(packet)

  ;(function broadcast () {
    // abort if the service have been unpublished in the meantime
    if (!service.published) return

    server.mdns.respond(packet, function () {
      // This function will optionally be called with an error object. We'll
      // just silently ignore it and retry as we normally would
      delay = delay * REANNOUNCE_FACTOR
      if (delay < REANNOUNCE_MAX_MS) setTimeout(broadcast, delay)
    })
  })()
}

/**
 * Stop the given services
 *
 * Besides removing a service from the mDNS registry, a "goodbye"
 * message is sent for each service to let the network know about the
 * shutdown.
 */
function teardown (server, services, cb) {
  if (!Array.isArray(services)) services = [services]

  var records = flatten(services
    .filter(function (service) {
      return service.published
    })
    .map(function (service) {
      service.published = false
      var records = service.records()
      records.forEach(function (record) {
        record.ttl = 0 // prepare goodbye message
      })
      return records
    }))

  if (records.length === 0) return

  server.unregister(records)
  server.mdns.respond(records, cb) // send goodbye message
}
