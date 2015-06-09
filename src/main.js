var app = require('app');
var BrowserWindow = require('browser-window');
var ipc = require('ipc');
var fs = require('fs');

require('crash-reporter').start();

var mainWindow = null;

app.on('window-all-closed', function() {
  //TODO: exit when computer restart, to see what node service should do when system down?
  //app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({
	width: 1366,
	height: 768,
	show: false,
	frame: false,
	'node-integration': false,
	preload: __dirname + '/preload.js'
  });

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  //mainWindow.openDevTools();

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});

ipc.on('WriteFile', function(event, filename, buf){
  fs.writeFile(filename, buf, function(err) {
    console.log("write file finished: "+Date.now());
    if(err){
      console.log(err);
    }
  });
});