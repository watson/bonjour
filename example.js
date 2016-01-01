
var bonjour = require('./index')()

// advertise an HTTP server on port 3000
var service = { name: 'My Web Server', type: 'http', port: 3000 }
bonjour.publish(service)

// browse for all http services
var httpservice = bonjour.find({ type: 'http' }, function (service) {
  console.log('Found an HTTP server:', service)
})

setTimeout(function () {
  bonjour.unpublishAll(function bye () {
    console.log('unpublished service:', service)
  })
  // wait for down of http service
  httpservice.on('down', function () {
    // try lookup again with a timeout
    bonjour.findOne({ type: service.type, timeout: 1500 }, function (service) {
      service && console.log('Found a service!', service)
      !service && console.log('There is no such service!')
      // then quit properly
      console.log('byebye')
      bonjour.destroy()
    })
  })
}, 1500)
