var app = require('app');
var BrowserWindow = require('browser-window');

require('crash-reporter').start();

var mainWindow = null;

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({
	width: 1024,
	height: 768,
	show: true,
	frame: false,
	'node-integration': false,
	preload: __dirname + '/preload.js'
  });

  mainWindow.loadUrl('http://localhost:8080');

  //mainWindow.openDevTools();

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});