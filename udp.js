'use strict'

var publish = require('./lib/registry').publish

var PROTOCOL = 'udp'

exports.publish = publish.bind(null, PROTOCOL)
