/**
 * Created by khejing on 2015/6/30.
 */

var mqtt = require('mqtt');
var headless = require('headless');
var electronPath = require('electron-prebuilt');
var childProcess = require('child_process');

var recordingTopic = "recording";
var mqttClientInstance = mqtt.connect("mqtt://localhost:1883", {clientId: recordingTopic});
mqttClientInstance.on('connect', function () {
    console.log("connect mqtt server success");
});
mqttClientInstance.on('error',function(error) {
    console.log("mqtt connect failed: ", error);
});
mqttClientInstance.subscribe(recordingTopic);

mqttClientInstance.on('message', function(messageTopic, data) {
    var object = JSON.parse(data);
    console.log("recv msg: " + data);
    var options = {
        display: {width: 1024, height: 980, depth: 24}
    };

    headless(options, function(err, childProcess, servernum) {
        // childProcess is a ChildProcess, as returned from child_process.spawn()
        console.log('Xvfb running on server number', servernum);
        console.log('Xvfb pid', childProcess.pid);
        console.log('err should be null', err);
        // spawn electron
        var electronChild = childProcess.spawn(electronPath, [__dirname+"/electron_app"], {env: {DISPLAY:":"+servernum+".0", TopicToSubscribe: data}});
    });
});
/* when got exit signal, then exit
mqttClientInstance.end();
mqttClientInstance = null;
console.log("mqtt client has been destroyed");
*/