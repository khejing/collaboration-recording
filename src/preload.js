// Load remote module here and remove node integration
window.__electron__remote = require('remote');
window.__electron__ipc = require('ipc');