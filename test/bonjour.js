'use strict'

var os = require('os')
var dgram = require('dgram')
var tape = require('tape')
var afterAll = require('after-all')
var Service = require('../lib/service')
var Bonjour = require('../')

var port = function (cb) {
  var s = dgram.createSocket('udp4')
  s.bind(0, function () {
    var port = s.address().port
    s.on('close', function () {
      cb(port)
    })
    s.close()
  })
}

var test = function (name, fn) {
  tape(name, function (t) {
    port(function (p) {
      fn(Bonjour({ ip: '127.0.0.1', port: p, multicast: false }), t)
    })
  })
}

test('bonjour.publish', function (bonjour, t) {
  var service = bonjour.publish({ name: 'foo', type: 'bar', port: 3000 })
  t.ok(service instanceof Service)
  t.equal(service.published, false)
  service.on('up', function () {
    t.equal(service.published, true)
    bonjour.destroy()
    t.end()
  })
})

test('bonjour.unpublishAll', function (bonjour, t) {
  var service = bonjour.publish({ name: 'foo', type: 'bar', port: 3000 })
  service.on('up', function () {
    bonjour.unpublishAll(function () {
      t.equal(service.published, false)
      bonjour.destroy()
      t.end()
    })
  })
})

test('bonjour.find', function (bonjour, t) {
  var next = afterAll(function () {
    var browser = bonjour.find({ type: 'test' })
    var ups = 0

    browser.on('up', function (s) {
      if (s.name === 'Foo Bar') {
        t.equal(s.name, 'Foo Bar')
        t.equal(s.fqdn, 'Foo Bar._test._tcp.local')
        t.deepEqual(s.txt, {})
        t.deepEqual(s.rawTxt, new Buffer('00', 'hex'))
      } else {
        t.equal(s.name, 'Baz')
        t.equal(s.fqdn, 'Baz._test._tcp.local')
        t.deepEqual(s.txt, { foo: 'bar' })
        t.deepEqual(s.rawTxt, new Buffer('07666f6f3d626172', 'hex'))
      }
      t.equal(s.host, os.hostname())
      t.equal(s.port, 3000)
      t.equal(s.type, 'test')
      t.equal(s.protocol, 'tcp')
      t.deepEqual(s.subtypes, [])
      t.deepEqual(s.addresses, [])

      if (++ups === 2) {
        // use timeout in an attempt to make sure the invalid record doesn't
        // bubble up
        setTimeout(function () {
          bonjour.destroy()
          t.end()
        }, 1000)
      }
    })
  })

  bonjour.publish({ name: 'Foo Bar', type: 'test', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Baz', type: 'test', port: 3000, txt: { foo: 'bar' } }).on('up', next())
})

test('bonjour.find - down event', function (bonjour, t) {
  var service = bonjour.publish({ name: 'Foo Bar', type: 'test', port: 3000 })

  service.on('up', function () {
    var browser = bonjour.find({ type: 'test' })

    browser.on('up', function (s) {
      t.equal(s.name, 'Foo Bar')
      service.stop()
    })

    browser.on('down', function (s) {
      t.equal(s.name, 'Foo Bar')
      bonjour.destroy()
      t.end()
    })
  })
})

test('bonjour.findOne - callback', function (bonjour, t) {
  var next = afterAll(function () {
    bonjour.findOne({ type: 'test' }, function (s) {
      t.equal(s.name, 'Callback')
      bonjour.destroy()
      t.end()
    })
  })

  bonjour.publish({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Callback', type: 'test', port: 3000 }).on('up', next())
})

test('bonjour.findOne - emitter', function (bonjour, t) {
  var next = afterAll(function () {
    var browser = bonjour.findOne({ type: 'test' })
    browser.on('up', function (s) {
      t.equal(s.name, 'Emitter')
      bonjour.destroy()
      t.end()
    })
  })

  bonjour.publish({ name: 'Emitter', type: 'test', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next())
})

test('bonjour.findOne - subtype', function (bonjour, t) {
  var next = afterAll(function () {
    var browser = bonjour.find({ type: 'bar', subtypes: ['sub1'] })
    browser.on('up', function (s) {
      t.equal(s.name, 'Foo')
      t.equal(s.port, 3000)
      // use timeout in an attempt to make sure the invalid record doesn't
      // bubble up
      setTimeout(function () {
        bonjour.destroy()
        t.end()
      }, 2000)
    })
  })

  bonjour.publish({ name: 'Foo', type: 'bar', port: 3000, subtypes: ['sub1'] }).on('up', next())
  bonjour.publish({ name: 'Invalid', type: 'bar', port: 3001, subtypes: ['sub2'] }).on('up', next())
})

test('bonjour.find - all of subtype', function (bonjour, t) {
  var next = afterAll(function () {
    var browser = bonjour.find({ type: 'baz' })
    var ups = 0

    browser.on('up', function (s) {
      if (s.name === 'Foo') {
        t.equal(s.name, 'Foo')
        t.equal(s.fqdn, 'Foo._baz._tcp.local')
        t.equal(s.port, 3000)
      } else if (s.name === 'Bar') {
        t.equal(s.name, 'Bar')
        t.equal(s.fqdn, 'Bar._baz._tcp.local')
        t.equal(s.port, 3001)
      }

      if (++ups === 2) {
        bonjour.destroy()
        t.end()
      }
    })
  })

  bonjour.publish({ name: 'Foo', type: 'baz', port: 3000, subtypes: ['sub1'] }).on('up', next())
  bonjour.publish({ name: 'Bar', type: 'baz', port: 3001, subtypes: ['sub2'] }).on('up', next())
})
