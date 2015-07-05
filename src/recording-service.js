/**
 * Created by khejing on 2015/6/30.
 */

var mqtt = require('mqtt');
var headless = require('headless');
var electronPath = require('electron-prebuilt');
var childProcess = require('child_process');
var portFinder = require('portfinder');
var ffmpeg = require('fluent-ffmpeg');
var moment = require('moment');

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
    var msg = JSON.parse(data);
    var options = {
        display: {width: 1366, height: 768, depth: 24}
    };
    headless(options, function(err, xvfbChildProcess, servernum) {
        // childProcess is a ChildProcess, as returned from child_process.spawn()
        console.log('Xvfb running on server number', servernum);
        console.log('Xvfb pid', xvfbChildProcess.pid);
        console.log('err should be null', err);
        var displayOpt = ":"+servernum+".0";
        // spawn electron after xvfb has been started
        var electronChild = childProcess.spawn(electronPath, [__dirname+"/electron_app"], {env: {DISPLAY: displayOpt, TopicToSubscribe: data}});
        electronChild.stderr.on('data', function(data){
            process.stdout.write(data.toString());
        });
        portFinder.getPort(function (err, port) {
            console.log("got free port: "+port);
            function ffmpegLog(data){
                console.log(data);
            }
            var ffmpegCommand = ffmpeg({logger: {debug: ffmpegLog, info: ffmpegLog, warn: ffmpegLog, error: ffmpegLog}});
            ffmpegCommand
                .input("tcp://localhost:"+port+"?listen=1")
                .input(displayOpt)
                .inputFormat("x11grab")
                .inputFPS(25)
                .inputOptions("-video_size 1366x768")
                .output(msg.topic[0]+msg.topic[1]+moment().format("YYYYMMDDHHmmss")+".m3u8")
                .audioCodec("aac")
                .videoCodec("libx264")
                .run();
        });
    });
});
/* when got exit signal, then exit
mqttClientInstance.end();
mqttClientInstance = null;
console.log("mqtt client has been destroyed");
*/