'use strict'

var Registry = require('./lib/Registry.js')
var Server = require('./lib/Server.js')
var Browser = require('./lib/Browser.js')

function Bonjour (opts) {
  if (!(this instanceof Bonjour)) { return new Bonjour(opts) }

  this._server = new Server(opts)
  this._registry = new Registry(this._server)
}

Bonjour.prototype = {
  publish: function (opts) {
    return this._registry.publish(opts)
  },

  unpublishAll: function (cb) {
    this._registry.unpublishAll(cb)
  },

  find: function (opts, onup) {
    return new Browser(this._server.mdns, opts, onup)
  },

  findOne: function (opts, cb) {
    var browser = new Browser(this._server.mdns, opts)
    browser.once('up', function (service) {
      browser.stop()
      if (cb) cb(service)
    })
    return browser
  },

  destroy: function () {
    this._registry.destroy()
    this._server.mdns.destroy()
  }
}

module.exports = Bonjour
