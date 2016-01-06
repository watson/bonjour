'use strict'

var os = require('os')
var test = require('tape')
var Service = require('../lib/service')

test('no name', function (t) {
  t.throws(function () {
    new Service({ type: 'http', port: 3000 }) // eslint-disable-line no-new
  }, 'Required name not given')
  t.end()
})

test('no type', function (t) {
  t.throws(function () {
    new Service({ name: 'Foo Bar', port: 3000 }) // eslint-disable-line no-new
  }, 'Required type not given')
  t.end()
})

test('no port', function (t) {
  t.throws(function () {
    new Service({ name: 'Foo Bar', type: 'http' }) // eslint-disable-line no-new
  }, 'Required port not given')
  t.end()
})

test('minimal', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', port: 3000 })
  t.equal(s.name, 'Foo Bar')
  t.equal(s.protocol, 'tcp')
  t.equal(s.type, 'http')
  t.equal(s.host, os.hostname().split('.')[0])
  t.equal(s.port, 3000)
  t.equal(s.fqdn, 'Foo Bar._http._tcp.local')
  t.equal(s.txt, null)
  t.deepEqual(s.subtypes, [])
  t.equal(s.published, false)
  t.end()
})

test('protocol', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, protocol: 'udp' })
  t.deepEqual(s.protocol, 'udp')
  t.end()
})

test('host', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, host: 'example.com' })
  t.deepEqual(s.host, 'example')
  t.deepEqual(s.parentDomain, 'com')
  t.end()
})

test('txt', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, txt: { foo: 'bar' } })
  t.deepEqual(s.txt, { foo: 'bar' })
  t.end()
})

test('_records() - minimal', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', protocol: 'tcp', port: 3000 })
  var r = s._records()
  t.deepEqual(r[0], { data: s.fqdn, name: '_http._tcp.local', ttl: 28800, type: 'PTR' })
  t.deepEqual(r[1], { data: { port: 3000, target: os.hostname() }, name: s.fqdn, ttl: 120, type: 'SRV' })
  t.deepEqual(r[2], { data: new Buffer('00', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' })
  t.end()
})

test('_records() - everything', function (t) {
  var s = new Service({ name: 'Foo Bar', type: 'http', protocol: 'tcp', port: 3000, host: 'example.com', txt: { foo: 'bar' }, subtypes: ['foo', 'bar'] })
  var r = s._records()
  t.deepEqual(r[0], { data: s.fqdn, name: 'foo.bar._sub._http._tcp.local', ttl: 28800, type: 'PTR' })
  t.deepEqual(r[1], { data: { port: 3000, target: 'example.com' }, name: s.fqdn, ttl: 120, type: 'SRV' })
  t.deepEqual(r[2], { data: new Buffer('07666f6f3d626172', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' })
  t.end()
})
