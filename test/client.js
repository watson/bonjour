var bonjour = require('../')()
let browser = bonjour.find({ type: 'nmos-node', maxItems: 5 }, function (service) {
    console.log('Found an nmos-node:', service.fqdn, "#", browser.services.map(s => s.fqdn).join(","));
}); 