# bonjour

A Bonjour/Zeroconf protocol implementation in JavaScript.

**This project is still work-in-progress**

[![Build status](https://travis-ci.org/watson/bonjour.svg?branch=master)](https://travis-ci.org/watson/bonjour)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Installation

This project is still not on npm, but for now you can install it
directly from GitHub via:

```
npm install watson/bonjour
```

## Usage

Advertising new services:

```js
var bonjour = require('bonjour')()

// advertise an HTTP server on port 3000
bonjour.tcp.publish('http', 3000)

// or give it a custom name and configuration details
bonjour.publish({ type: 'http', protocol: 'tcp', port: 3000, name: 'Foobar', txt: {...} })
```

## License

MIT
