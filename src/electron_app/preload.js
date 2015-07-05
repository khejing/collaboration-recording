// Load node module here and remove node integration
window.electronRemote = require('remote');
window.topicToSubscribe = JSON.parse(process.env.TopicToSubscribe);