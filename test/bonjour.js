'use strict'

var os = require('os')
var dgram = require('dgram')
var tape = require('tape')
var afterAll = require('after-all')
var Service = require('../lib/Service.js')
var Bonjour = require('../')
var Buffer = require('safe-buffer').Buffer

var getAddresses = function () {
  var addresses = []
  var itrs = os.networkInterfaces()
  for (var i in itrs) {
    var addrs = itrs[i]
    for (var j in addrs) {
      if (addrs[j].internal === false) {
        addresses.push(addrs[j].address)
      }
    }
  }
  return addresses
}

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
  t.test('published services', function (t) {
    var service = bonjour.publish({ name: 'foo', type: 'bar', port: 3000 })
    service.on('up', function () {
      bonjour.unpublishAll(function (err) {
        t.error(err)
        t.equal(service.published, false)
        bonjour.destroy()
        t.end()
      })
    })
  })

  t.test('no published services', function (t) {
    bonjour.unpublishAll(function (err) {
      t.error(err)
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
        t.deepEqual(s.rawTxt, Buffer.from('00', 'hex'))
      } else {
        t.equal(s.name, 'Baz')
        t.equal(s.fqdn, 'Baz._test._tcp.local')
        t.deepEqual(s.txt, { foo: 'bar' })
        t.deepEqual(s.rawTxt, Buffer.from('07666f6f3d626172', 'hex'))
      }
      t.equal(s.host, os.hostname())
      t.equal(s.port, 3000)
      t.equal(s.type, 'test')
      t.equal(s.protocol, 'tcp')
      t.equal(s.referer.address, '127.0.0.1')
      t.equal(s.referer.family, 'IPv4')
      t.ok(Number.isFinite(s.referer.port))
      t.ok(Number.isFinite(s.referer.size))
      t.deepEqual(s.subtypes, [])
      t.deepEqual(s.addresses.sort(), getAddresses().sort())

      if (++ups === 2) {
        // use timeout in an attempt to make sure the invalid record doesn't
        // bubble up
        setTimeout(function () {
          bonjour.destroy()
          t.end()
        }, 50)
      }
    })
  })

  bonjour.publish({ name: 'Foo Bar', type: 'test', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next())
  bonjour.publish({ name: 'Baz', type: 'test', port: 3000, txt: { foo: 'bar' } }).on('up', next())
})

test('bonjour.change', function (bonjour, t) {
  var data = {init: true, found: false, timer: null}
  var service = bonjour.publish({ name: 'Baz', type: 'test', port: 3000, txt: { foo: 'bar' } }).on('up', function () {
    var browser = bonjour.find({ type: 'test' })
    browser.on('up', function (s) {
      data.browserData = s

      if (data.init) {
        t.equal(s.txt.foo, 'bar')
        data.timer = setTimeout(function () {
          t.equal(s.txt.foo, 'baz')
          bonjour.destroy()
          t.end()
        }, 3000) // Wait for the record to update maximum 3000 ms
        data.init = false
        service.updateTxt({foo: 'baz'})
      }

      if (!data.init && !data.found && s.txt.foo === 'baz') {
        data.found = true
        clearTimeout(data.timer)
        t.equal(s.txt.foo, 'baz')
        bonjour.destroy()
        t.end()
      }
    })
  })
})

test('bonjour.find - binary txt', function (bonjour, t) {
  var next = afterAll(function () {
    var browser = bonjour.find({ type: 'test', txt: { binary: true } })

    browser.on('up', function (s) {
      t.equal(s.name, 'Foo')
      t.deepEqual(s.txt, { bar: Buffer.from('buz') })
      t.deepEqual(s.rawTxt, Buffer.from('076261723d62757a', 'hex'))
      bonjour.destroy()
      t.end()
    })
  })

  bonjour.publish({ name: 'Foo', type: 'test', port: 3000, txt: { bar: Buffer.from('buz') } }).on('up', next())
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
