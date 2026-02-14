'use strict'

var os = require('os')
var test = require('tape')
var Server = require('../lib/mdns-server')
var Service = require('../lib/service')

function stubNetworkInterfaces (t, interfaces) {
  var originalNetworkInterfaces = os.networkInterfaces
  os.networkInterfaces = function () {
    return interfaces
  }
  t.once('end', function () {
    os.networkInterfaces = originalNetworkInterfaces
  })
}

function createServer () {
  var packets = []
  var server = Object.create(Server.prototype)

  server.registry = {}
  server.services = {}
  server.mdns = {
    respond: function (packet, cb) {
      packets.push(packet)
      if (cb) cb()
    }
  }

  return { server: server, packets: packets }
}

function createService (opts) {
  return new Service({
    name: 'Test Service',
    type: 'http',
    protocol: 'tcp',
    port: 3000,
    host: opts.host || 'test-host.local',
    addresses: opts.addresses
  })
}

test('PTR responses include only interface-valid host addresses', function (t) {
  stubNetworkInterfaces(t, {
    eth0: [
      { address: '192.168.1.10', family: 'IPv4', cidr: '192.168.1.10/24', internal: false },
      { address: '10.0.0.10', family: 'IPv4', cidr: '10.0.0.10/24', internal: false }
    ]
  })

  var fixture = createServer()
  var service = createService({})

  fixture.server.register(service._records(), service)
  fixture.server._respondToQuery({
    questions: [{ name: '_http._tcp.local', type: 'PTR' }]
  }, { address: '192.168.1.77' })

  t.equal(fixture.packets.length, 1)
  t.equal(fixture.packets[0].answers.length, 1)
  t.equal(fixture.packets[0].answers[0].type, 'PTR')

  var aRecords = fixture.packets[0].additionals
    .filter(function (record) { return record.type === 'A' })
    .map(function (record) { return record.data })
    .sort()
  t.deepEqual(aRecords, ['192.168.1.10'])
  t.end()
})

test('direct A queries return only interface-valid IPv4 records', function (t) {
  stubNetworkInterfaces(t, {
    eth0: [
      { address: '192.168.50.2', family: 'IPv4', cidr: '192.168.50.2/24', internal: false },
      { address: '10.99.0.2', family: 'IPv4', cidr: '10.99.0.2/24', internal: false }
    ]
  })

  var fixture = createServer()
  var service = createService({ host: 'service-a.local' })

  fixture.server.register(service._records(), service)
  fixture.server._respondToQuery({
    questions: [{ name: 'service-a.local', type: 'A' }]
  }, { address: '192.168.50.200' })

  t.equal(fixture.packets.length, 1)
  t.deepEqual(fixture.packets[0].answers.map(function (record) { return record.data }), ['192.168.50.2'])
  t.deepEqual(fixture.packets[0].additionals, [])
  t.end()
})

test('direct AAAA queries return only interface-valid IPv6 records', function (t) {
  stubNetworkInterfaces(t, {
    eth0: [
      { address: 'fd00::1', family: 'IPv6', cidr: 'fd00::1/64', internal: false },
      { address: '2001:db8::1', family: 'IPv6', cidr: '2001:db8::1/64', internal: false }
    ]
  })

  var fixture = createServer()
  var service = createService({ host: 'service-aaaa.local' })

  fixture.server.register(service._records(), service)
  fixture.server._respondToQuery({
    questions: [{ name: 'service-aaaa.local', type: 'AAAA' }]
  }, { address: 'fd00::99' })

  t.equal(fixture.packets.length, 1)
  t.deepEqual(fixture.packets[0].answers.map(function (record) { return record.data }), ['fd00::1'])
  t.end()
})

test('ANY queries do not leak off-interface addresses', function (t) {
  stubNetworkInterfaces(t, {
    eth0: [
      { address: '172.16.0.10', family: 'IPv4', cidr: '172.16.0.10/24', internal: false },
      { address: '10.10.0.10', family: 'IPv4', cidr: '10.10.0.10/24', internal: false }
    ]
  })

  var fixture = createServer()
  var service = createService({ host: 'service-any.local' })

  fixture.server.register(service._records(), service)
  fixture.server._respondToQuery({
    questions: [{ name: 'service-any.local', type: 'ANY' }]
  }, { address: '172.16.0.44' })

  t.equal(fixture.packets.length, 1)
  t.deepEqual(fixture.packets[0].answers.map(function (record) { return record.data }), ['172.16.0.10'])
  t.end()
})

test('explicit service addresses are used as candidates and still interface-filtered', function (t) {
  stubNetworkInterfaces(t, {
    eth0: [
      { address: '192.168.88.10', family: 'IPv4', cidr: '192.168.88.10/24', internal: false },
      { address: '192.168.88.11', family: 'IPv4', cidr: '192.168.88.11/24', internal: false }
    ]
  })

  var fixture = createServer()
  var service = createService({
    host: 'service-explicit.local',
    addresses: [
      { address: '192.168.88.11', family: 'IPv4' },
      { address: '203.0.113.1', family: 'IPv4' }
    ]
  })

  fixture.server.register(service._records(), service)
  fixture.server._respondToQuery({
    questions: [{ name: 'service-explicit.local', type: 'A' }]
  }, { address: '192.168.88.33' })

  t.equal(fixture.packets.length, 1)
  t.deepEqual(fixture.packets[0].answers.map(function (record) { return record.data }), ['192.168.88.11'])
  t.end()
})
