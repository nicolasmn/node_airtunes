var mdns = require('mdns');

// Exit after one second as the mdns browser prevents node from exiting
setTimeout(function() { process.exit(0); }, 1000);

var browser = mdns.createBrowser(mdns.tcp('raop'));

browser.on('serviceUp', function(service) {
  console.log(service.name.match(/.*@(.*)/)[1] + " " + service.host + ":" + service.port);
});
browser.start();