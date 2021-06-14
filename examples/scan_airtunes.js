const mdns = require('mdns');

const browser = mdns.createBrowser(mdns.tcp('raop'));
browser.on('serviceUp', service => {
  console.log(
    `${service.name} ${service.host}:${service.port}`
  );
});
browser.start();

setTimeout(() => {browser.stop()},300);
