'use strict'

var os = require('os')
var test = require('tape')
var Service = require('../lib/service')

var hostname = os.hostname()
var host = hostname.replace(/\.local\.?$/, '')

test('no type', function (t) {
  t.throws(function () {
    new Service({ protocol: 'tcp', port: 3000 }) // eslint-disable-line no-new
  }, 'Required type not given')
  t.end()
})

test('no port', function (t) {
  t.throws(function () {
    new Service({ type: 'http', protocol: 'tcp' }) // eslint-disable-line no-new
  }, 'Required port not given')
  t.end()
})

test('no port', function (t) {
  t.throws(function () {
    new Service({ type: 'http', port: 3000 }) // eslint-disable-line no-new
  }, 'Required protocol not given')
  t.end()
})

test('minimal', function (t) {
  var s = new Service({ type: 'http', protocol: 'tcp', port: 3000 })
  t.equal(s.name, host)
  t.equal(s.type, '_http._tcp')
  t.equal(s.port, 3000)
  t.equal(s.fqdn, host + '._http._tcp.local')
  t.equal(s.txt, undefined)
  t.equal(s.published, true)
  t.end()
})

test('name', function (t) {
  var s = new Service({ type: 'http', protocol: 'tcp', port: 3000, name: 'Foobar' })
  t.equal(s.name, 'Foobar')
  t.equal(s.type, '_http._tcp')
  t.equal(s.port, 3000)
  t.equal(s.fqdn, 'Foobar._http._tcp.local')
  t.equal(s.txt, undefined)
  t.equal(s.published, true)
  t.end()
})

test('txt', function (t) {
  var s = new Service({ type: 'http', protocol: 'tcp', port: 3000, txt: { foo: 'bar' } })
  t.deepEqual(s.txt, { foo: 'bar' })
  t.end()
})

test('records() - minimal', function (t) {
  var s = new Service({ type: 'http', protocol: 'tcp', port: 3000 })
  t.deepEqual(s.records(), [
    { data: s.fqdn, name: '_http._tcp.local', ttl: 28800, type: 'PTR' },
    { data: { port: 3000, target: hostname }, name: s.fqdn, ttl: 120, type: 'SRV' },
    { data: new Buffer('00', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' }
  ])
  t.end()
})

test('records() - everything', function (t) {
  var s = new Service({ type: 'http', protocol: 'tcp', port: 3000, name: 'Foobar', txt: { foo: 'bar' } })
  t.deepEqual(s.records(), [
    { data: s.fqdn, name: '_http._tcp.local', ttl: 28800, type: 'PTR' },
    { data: { port: 3000, target: hostname }, name: s.fqdn, ttl: 120, type: 'SRV' },
    { data: new Buffer('07666f6f3d626172', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' }
  ])
  t.end()
})
