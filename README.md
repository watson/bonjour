# zeroconf

**Deprecation notice: This module have been renamed to
[bonjour](https://www.npmjs.com/package/bonjour)**

A Bonjour/Zeroconf protocol implementation in JavaScript.

[![Build status](https://travis-ci.org/watson/zeroconf.svg?branch=master)](https://travis-ci.org/watson/zeroconf)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Installation

```
npm install zeroconf
```

## Usage

Advertising new services:

```js
var zeroconf = require('zeroconf')()

// advertise an HTTP server on port 3000
zeroconf.tcp.publish('http', 3000)

// or give it a custom name and configuration details
zeroconf.publish({ type: 'http', protocol: 'tcp', port: 3000, name: 'Foobar', txt: {...} })
```

## License

MIT
