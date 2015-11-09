'use strict'

var mdns = require('./mdns')
var server = require('./mdns-server')
var Service = require('./service')

var services = []

var REANNOUNCE_MAX_MS = 60 * 60 * 1000
var REANNOUNCE_FACTOR = 3

exports.publish = function publish (protocol, opts) {
  if (typeof opts === 'string') return publish(protocol, { type: opts, port: arguments[2] })
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')

  opts.protocol = protocol

  var service = new Service(opts)
  service.unpublish = function (cb) {
    teardown(service, cb)
    var index = services.indexOf(service)
    if (index !== -1) services.splice(index, 1)
  }
  services.push(service)

  // TODO: The RFC allows that probing can be optional if it's know that
  // the name is unique or in some way is already owned by the service (but
  // maybe the class then need to change)
  probe(service, function (exists) {
    if (exists) throw new Error('Service name is already in use on the network') // TODO: Handle this. Maybe implement fallback option to auto-increment a number trailing the name
    announce(service)
  })

  return service
}

exports.unpublishAll = function () {
  teardown(services)
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
function probe (service, cb) {
  var sent = false
  var retries = 0
  var retryTimer

  mdns.on('response', onresponse)
  setTimeout(send, Math.random() * 250)

  function send () {
    // abort if the service have been unpublished in the meantime
    if (!service.published) return

    mdns.query(service.name, 'ANY', function () {
      // This function will optionally be called with an error object. We'll
      // just silently ignore it and retry as we normally would
      // TODO: Maybe we should not just ignore it we have no successfull probes at all?
      sent = true
      if (++retries < 3) retryTimer = setTimeout(send, 250)
      else done()
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
    return rr.name === service.name
  }

  function done (exists) {
    mdns.removeListener('response', onresponse)
    clearTimeout(retryTimer)
    cb(!!exists)
  }
}

/**
 * Initial service announcement
 *
 * Used to announce new services when they are first registered.
 *
 * Broadcasts right away, then after 3 seconds, 9 seconds, 27 seconds,
 * and so on, up to a maximum interval og one hour.
 */
function announce (service) {
  var delay = 1000
  var packet = service.records()

  server.register(packet)

  ;(function broadcast () {
    // abort if the service have been unpublished in the meantime
    if (!service.published) return

    mdns.respond(packet, function () {
      // This function will optionally be called with an error object. We'll
      // just silently ignore it and retry as we normally would
      delay = delay * REANNOUNCE_FACTOR
      if (delay < REANNOUNCE_MAX_MS) setTimeout(broadcast, delay)
    })
  })()
}

/**
 * Stop a given service
 *
 * Besides removing the service from the mDNS registry, it's recommended to
 * send a "goodbye" message to let the network know about the shutdown.
 */
function teardown (services, cb) {
  if (!Array.isArray(service)) services = [services]

  var records = flatten(services
    .filter(function (service) {
      return service.published
    })
    .map(function (service) {
      service.published = false
      var records = service.records()
      records.forEach(function (record) {
        record.ttl = 0
      })
      return records
    }))

  if (records.length === 0) return

  server.unregister(records)
  mdns.respond(records, cb)
}

function flatten (arr) {
  return [].concat.apply.bind([].concat, [])(arr)
}
