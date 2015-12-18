# bonjour

A Bonjour/Zeroconf protocol implementation in JavaScript.

**This project is still work-in-progress**

[![Build status](https://travis-ci.org/watson/bonjour.svg?branch=master)](https://travis-ci.org/watson/bonjour)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Installation

```
npm install bonjour
```

## Usage

Advertise a new service:

```js
var bonjour = require('bonjour')()

// advertise an HTTP server on port 3000
bonjour.publish({ name: 'My Web Server', type: 'http', port: 3000 })
```

Discover services:

```js
bonjour.find({ type: 'http' }, function (service) {
  console.log('Found an HTTP server:', service)
})
```

## API

### Initializing

```js
var bonjour = require('bonjour')([options])
```

Options are:

- `multicast` - use udp multicasting
- `interface` - explicitly specify a network interface. defaults to all
- `port` - set the udp port
- `ip` - set the udp ip
- `ttl` - set the multicast ttl
- `loopback` - receive your own packets
- `reuseAddr` - set the reuseAddr option when creating the socket
  (requires node >=0.11.13)

### Publishing

Allow the user to publish a new service on the network.

A service have the following properties:

- name: `'Apple TV'`
- type: `'airplay'`
- protocol: `'tcp'`
- host: `'hostname.local'`
- port: `5000`
- txt: `{...}` (optional)
- subtypes: `['api-v1']` (optional)

#### `var service = bonjour.publish(options)`

Publishes a new service.

Options are:

- `name` (string)
- `host` (string, optional) - defaults to local hostname
- `port` (number)
- `type` (string)
- `subtypes` (array of strings, optional)
- `protocol` (string, optional) - defaults to `tcp`
- `txt` (object, optional) - a key/value object to broadcast as the TXT
  record

#### `bonjour.unpublishAll([callback])`

Unpublish all services. The optional `callback` will be called when the
services have been unpublished.

### Browser

#### `var browser = bonjour.find(options[, onup])`

Listen for services advertised on the network. An optional callback can
be provided as the 2nd argument and will be added as an event listener
for the `up` event.

Options are:

- `type` (string)
- `subtypes` (array of strings, optional)
- `protocol` (string, optional) - defaults to `tcp`

#### `var browser = bonjour.findOne(options[, callback])`

Listen for and call the `callback` with the first instance of a service
matching the `options`. If no `callback` is given, it's expected that
you listen for the `up` event. The returned `browser` will automatically
stop it self after the first matching service.

Options are the same as given in the `browser.find` function.

#### `Event: up`

Emitted every time a new service is found that matches the browser.

#### `Event: down`

Emitted every time an existing service emmits a goodbye message.

#### `browser.services`

An array of services known by the browser to be online.

#### `browser.stop()`

Stop looking for matching services.

#### `browser.start()`

Start looking for matching services.

### Service

#### `Event: up`

Emitted when the service is up.

#### `Event: error`

Emitted if an error occurrs while publishing the service.

#### `service.stop([callback])`

Unpublish the service. The optional `callback` will be called when the
service have been unpublished.

#### `service.start()`

Publish the service.

#### `service.name`

The name of the service, e.g. `Apple TV`.

#### `service.type`

The type of the service, e.g. `http`.

#### `service.subtypes`

An array of subtypes. Note that this property might be `null`.

#### `service.protocol`

The protocol used by the service, e.g. `tcp`.

#### `service.host`

The hostname or ip address where the service resides.

#### `service.port`

The port on which the service listens, e.g. `5000`.

#### `service.fqdn`

The fully qualified domain name of the service. E.g. if given the name
`Foo Bar`, the type `http` and the protocol `tcp`, the `service.fqdn`
property will be `Foo Bar._http._tcp.local`.

#### `service.txt`

The TXT record advertised by the service (a key/value object). Note that
this property might be `null`.

#### `service.published`

A boolean indicating if the service is currently published.

## Todo

- Restrict a browser or an adverticement to a specific network
  interface, ip address, ip version(?) or interface index
- Support sending "goodbye" packets when shutting down
- Support receiving "goodbye" packets in the browser
- Support notifying the browser when a service changes
- Support storing received mDNS records in a cache
- Support TTL in the cache (in case of TTL=0, it should be handled as a
  goodbye packet nad the TTL should be set to 1 second)

## License

MIT
