var events = require('events'),
    util = require('util'),
    http = require('http'),
    mdns = require('mdns2'),
    querystring = require('querystring');

function Server(port, id, activeRemote) {
  events.EventEmitter.call(this);

  this.port = port;
  this.id = id;
  this.activeRemote = activeRemote;
}

util.inherits(Server, events.EventEmitter);

exports.Server = Server;

Server.prototype.start = function() {
  this.mdnsAdvertisement = mdns.createAdvertisement(mdns.tcp('dacp'), this.port, {
    name: 'iTunes_Ctrl_' + this.id
  });
  this.mdnsAdvertisement.start();	
  
  var self = this;

  this.httpServer = http.createServer(function (req, res) {
    var url = req.url;
    var match = url.match(/\/ctrl-int\/1\/([^?]+)\??(.*)?/);
    
    if (! match) { 
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end();
    } else {
      if (req.headers['active-remote'] != self.activeRemote) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end();
      }

      self.emit('command', match[1], match[2] ? querystring.parse(match[2]) : {});	
      res.writeHead(204, { 'Content-Type': 'application/x-dmap-tagged' });
      res.end();
    }
  });
  
  this.httpServer.listen(this.port);
};

Server.prototype.teardown = function() {
  this.mdnsAdvertisement.stop(); 
  try {
    this.httpServer.close();
  } catch (err) {
    // Ignore error closing http server
  }
};
