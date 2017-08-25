'use strict'

var os = require('os')
var util = require('util')
var EventEmitter = require('events').EventEmitter
var serviceName = require('multicast-dns-service-types')
var txt = require('dns-txt')()

var TLD = '.local'
var REANNOUNCE_MAX_MS = 60 * 60 * 1000
var REANNOUNCE_FACTOR = 3

var Service = function (opts) {
  if (!opts.name) throw new Error('Required name not given')
  if (!opts.type) throw new Error('Required type not given')
  if (!opts.port) throw new Error('Required port not given')

  this.name = opts.name
  this.protocol = opts.protocol || 'tcp'
  this.probe = opts.probe !== false
  this.type = serviceName.stringify(opts.type, this.protocol)
  this.host = opts.host || os.hostname()
  this.port = opts.port
  this.fqdn = this.name + '.' + this.type + TLD
  this.subtypes = opts.subtypes || null
  this.txt = opts.txt || null
  this.published = false

  this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

util.inherits(Service, EventEmitter)

var proto = {

  start: function () {
    if (this._activated) { return }

    this._activated = true

    this.emit('service-publish', this)
  },

  stop: function (cb) {
    if (!this._activated) { return } // cb && cb('Not active'); // TODO: What about the callback?

    this.emit('service-unpublish', this, cb)
  },

  updateTxt: function (txt) {
    this._unpublish()

    if (this.packet) { this.emit('service-packet-change', this.packet, this.onAnnounceComplete.bind(this)) }

    this.packet = null
    this.txt = txt
    this.announce()
  },

  announce: function () {
    if (this._destroyed) { return }

    if (!this.packet) { this.packet = this._records() }

    if (this.timer) { clearTimeout(this.timer) }

    this.delay = 1000
    this.emit('service-announce-request', this.packet, this.onAnnounceComplete.bind(this))
  },

  onAnnounceComplete: function () {
    if (!this.published) {
      this._activated = true // not sure if this is needed here
      this.published = true
      this.emit('up')
    }

    this.delay = this.delay * REANNOUNCE_FACTOR
    if (this.delay < REANNOUNCE_MAX_MS && !this._destroyed && this._activated) {
      this.timer = setTimeout(this.announce.bind(this), this.delay).unref()
    } else {
      this.timer = undefined
      this.delay = undefined
    }
  },

  deactivate: function () {
    this._unpublish()
    this._activated = false
  },

  destroy: function () {
    this._unpublish()
    this.removeAllListeners()
    this._destroyed = true
  },

  _unpublish: function () {
    if (this.timer) { clearTimeout(this.timer) }

    this.published = false
  },

  _records: function () {
    var records = [this._rrPtr(), this._rrSrv(), this._rrTxt()]

    var interfaces = os.networkInterfaces()
    for (var ifaceID in interfaces) {
      var iface = interfaces[ifaceID]
      for (var i = 0; i < iface.length; i++) {
        var address = iface[i]
        if (address.internal) { continue }

        records.push(
                    address.family === 'IPv4'
                    ? this._rrA(address.address)
                    : this._rrAaaa(address.address))
      }
    }

    return records
  },

  _rrPtr: function () {
    return {
      name: this.type + TLD,
      type: 'PTR',
      ttl: 28800,
      data: this.fqdn
    }
  },

  _rrSrv: function () {
    return {
      name: this.fqdn,
      type: 'SRV',
      ttl: 120,
      data: {
        port: this.port,
        target: this.host
      }
    }
  },

  _rrTxt: function () {
    return {
      name: this.fqdn,
      type: 'TXT',
      ttl: 4500,
      data: txt.encode(this.txt)
    }
  },

  _rrA: function (ip) {
    return {
      name: this.host,
      type: 'A',
      ttl: 120,
      data: ip
    }
  },

  _rrAaaa: function (ip) {
    return {
      name: this.host,
      type: 'AAAA',
      ttl: 120,
      data: ip
    }
  }

}

for (var x in proto) { Service.prototype[x] = proto[x] }

module.exports = Service
