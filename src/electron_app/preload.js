// Load node module here and remove node integration
window.__electron__ipc = require('ipc');
window.topicToSubscribe = JSON.parse(process.env.TopicToSubscribe);