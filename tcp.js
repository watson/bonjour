'use strict'

var publish = require('./lib/registry').publish

var PROTOCOL = 'tcp'

exports.publish = publish.bind(null, PROTOCOL)
