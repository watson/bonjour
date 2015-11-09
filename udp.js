'use strict'

var publish = require('./lib/registry').publish
var discover = require('./lib/discover')

var PROTOCOL = 'udp'

exports.publish = publish.bind(null, PROTOCOL)
exports.discover = discover.bind(null, PROTOCOL)
