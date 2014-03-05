var fs = require('fs'),
    path = require('path'),
    airtunes = require('../lib/'),
    spawn = require('child_process').spawn,
    argv = require('optimist')
      .usage('Usage: $0 --host [host] --port [num] --ffmpeg [path] --file [path] --volume [num] --password [string]')
      .default('port', 5000)
      .default('volume', 20)
      .default('ffmpeg', '/usr/local/bin/ffmpeg')
      .default('folder', '.')
      .demand(['host'])
      .argv;

function PlayList(folder) {
  this.files = fs.readdirSync(argv.folder).filter(function(f) { return f.match(/\.mp3$/); });
  this.idx = 0;
  this.file = undefined; 
  this.ffmpeg = undefined;
  this.metadata = undefined;
  
  this.playing = false;
  
  var self = this;
  var metadataCallback = function(status) {
    if (status == 'playing' && self.metadata) {
      device.setTrackInfo(self.metadata.title, self.metadata.artist, self.metadata.album);
      // Some devices seem to not record metadata until after a few seconds
      setTimeout(function() {
        device.setTrackInfo(self.metadata.title, self.metadata.artist, self.metadata.album);
      }, 2000);
    }
  };
  airtunes.on('buffer', metadataCallback);
  
  this.currentFile = function() {
    return argv.folder + "/" + this.files[this.idx]; 
  };

  this.play = function() {
    var file = this.currentFile();

    console.log("Playing " + file);
    this.playing = true;

    // Cancel existing ffmpeg process if exists
    if (this.ffmpeg) {
      this.ffmpeg.stdout.removeAllListeners();
      this.ffmpeg.removeAllListeners();
      this.ffmpeg.kill();
    }

    // Spawn ffmpeg
    this.ffmpeg = spawn(argv.ffmpeg, [
      '-i', file,
      '-f', 's16le',        // PCM 16bits, little-endian
      '-ar', '44100',       // Sampling rate
      '-ac', 2,             // Stereo
      'pipe:1'              // Output on stdout
    ]);

    // Pipe data to AirTunes
    this.ffmpeg.stdout.pipe(airtunes);

    // Detect if ffmpeg was not spawned correctly
    this.ffmpeg.stderr.setEncoding('utf8');
    this.ffmpeg.stderr.on('data', function(data) {
      if(/^execvp\(\)/.test(data)) {
        console.log('failed to start ' + argv.ffmpeg);
        process.exit(1);
      }
    });
    
    // If ffmpeg exits, move to next track
    this.ffmpeg.once("exit", function() {
      this.ffmpeg = undefined;
      self.next();
    });

    this.metadata = {
      title: path.basename(file, '.mp3'),
      artist: 'Unknown Artist',
      album: 'Unknown Album'
    };
    
    // Buffering events are not sent when moving from one track to the next, so explicitly call the metadataCallback
    device.setTrackInfo(self.metadata.title, self.metadata.artist, self.metadata.album);
  };
  
  this.next = function() {
    this.idx++;
    if (this.idx >= this.files.length) {
      this.idx = 0;
    }
    
    this.play();
  };

  this.previous = function() {
		this.idx--;
		if (this.idx < 0) {
			this.idx = this.files.length - 1;
		}
		
		this.play();
	};
};

console.log('Adding device: ' + argv.host + ':' + argv.port);
var device = airtunes.add(argv.host, argv);

var playlist = new PlayList(argv.folder);

device.on('remote-command', function(cmd, args) {
  console.log("remote command: " + cmd + ", args = " + JSON.stringify(args));
  if (cmd == "nextitem") {
    playlist.next();
  } else if (cmd == "previtem") {
    playlist.previous();
  }
});

// When the device is online, start playing
device.on('status', function(status) {
  console.log('Status: ' + status);

  if (status == 'stopped' && playlist.playing) {
    setTimeout(function() {
      airtunes.stopAll(function() {
        console.log('end');
        process.exit();
      });
    }, 2000);
  }

  if(status == 'ready')
    playlist.play();
});

// monitor buffer events
airtunes.on('buffer', function(status) {
  console.log('buffer ' + status);

  // after the playback ends, give some time to AirTunes devices
  if(status === 'end') {
    playlist.next();
  }
});
