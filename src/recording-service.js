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
var m3u8 = require("m3u8");
var fs = require("fs");

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
        electronChild.on("exit", function(){
            console.log("electron has been closed");
            xvfbChildProcess.exit();
        });
        portFinder.getPort(function (err, port) {
            console.log("got free port: "+port);
            function ffmpegLog(data){
                console.log(data);
            }
            function ffmpegOutput(command){
                command
                    .audioCodec("aac")
                    .videoCodec("libx264")
                    .outputOptions("-pix_fmt yuv420p", "-crf 28", "-g 50", "-hls_time 10", "-threads 0", "-shortest");
            }
            var filenamePrefix = msg.teacherTopic+"-"+msg.type+"-"+moment().format("YYYYMMDDHHmmss");
            var duration = -1;
            var ffmpegCommand = ffmpeg({logger: {debug: ffmpegLog, info: ffmpegLog, warn: ffmpegLog, error: ffmpegLog}});
            ffmpegCommand
                .input("tcp://localhost:"+port+"?listen=1")
                .input(displayOpt)
                .inputFormat("x11grab")
                .inputFPS(25)
                .inputOptions("-video_size 1366x768")
                .output(filenamePrefix+"-desktop"+".m3u8")
                .size("1280x720")
                .preset(ffmpegOutput)
                .output(filenamePrefix+"-tablet"+".m3u8")
                .size("640x360")
                .preset(ffmpegOutput)
                .outputOptions("-maxrate 1000K", "-bufsize 2000K")
                .output(filenamePrefix+"-smartphone"+".m3u8")
                .size("480x320")
                .autopad()
                .preset(ffmpegOutput)
                .outputOptions("-maxrate 500K", "-bufsize 1000K")
                .on("start", function(command){console.log(command);})
                .on("progress", function(data){
                    duration = data.timemark;
                    console.log("got time: "+data.timemark);
                })
                .on("end", function(){
                    console.log("ffmpeg ended!!!");
                    var m3u8Content = m3u8.M3U.create();
                    m3u.addStreamItem ({
                        uri: filenamePrefix+"-desktop"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 2001000,
                        RESOLUTION: "1280x720"
                    });
                    m3u.addStreamItem ({
                        uri: filenamePrefix+"-tablet"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 1001000,
                        RESOLUTION: "640x360"
                    });
                    m3u.addStreamItem ({
                        uri: filenamePrefix+"-smartphone"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 510000,
                        RESOLUTION: "480x320"
                    });
                    fs.writeFile(filenamePrefix+".m3u8", m3u.toString(), null, function(err){
                        if(err === null){
                            mqttClientInstance.publish(msg.clientId, {recording: "DurationAndURL", duration: duration, filenamePrefix: filenamePrefix});
                        }
                    });
                })
                .run();
            mqttClientInstance.publish(msg.clientId, {recording: "Port", port: port});
        });
    });
});
/* when got exit signal, then exit
mqttClientInstance.end();
mqttClientInstance = null;
console.log("mqtt client has been destroyed");
*/