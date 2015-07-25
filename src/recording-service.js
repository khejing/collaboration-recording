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
var PouchDB = require('pouchdb');

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
            function ffmpegOutput(command){
                command
                    .audioCodec("aac")
                    .videoCodec("libx264")
                    .outputOptions(["-pix_fmt yuv420p", "-crf 28", "-g 50", "-hls_time 10", "-threads 0", "-shortest"]);
            }
            var recordingFileName = msg.teacherTopic+"-"+msg.type+"-"+moment().format("YYYYMMDDHHmmss");
            var recordingFilePath = "/var/lib/recording/"+recordingFileName;
            var ffmpegCommand = ffmpeg({logger: {debug: ffmpegLog, info: ffmpegLog, warn: ffmpegLog, error: ffmpegLog}});
            ffmpegCommand
                .input("tcp://localhost:"+port+"?listen=1")
                .input(displayOpt)
                .inputFormat("x11grab")
                .inputFPS(25)
                .inputOptions(["-itsoffset 30", "-video_size 1366x768", "-draw_mouse 0"])
                .output(recordingFilePath+"-desktop"+".m3u8")
                .size("1280x720")
                .preset(ffmpegOutput)
                .output(recordingFilePath+"-tablet"+".m3u8")
                .size("640x360")
                .preset(ffmpegOutput)
                .outputOptions(["-maxrate 1000K", "-bufsize 2000K"])
                .output(recordingFilePath+"-smartphone"+".m3u8")
                .size("480x320")
                .autopad()
                .preset(ffmpegOutput)
                .outputOptions(["-maxrate 500K", "-bufsize 1000K"])
                .on("error", function(err, stdout, stderr){
                    console.log("got error from ffmpeg: "+err.message);
                    console.log("ffmpeg stderr: "+stderr);
                })
                .on("start", function(command){
					console.log(command);
					mqttClientInstance.publish(msg.clientId, JSON.stringify({recording: "Port", port: port}));
				})
                .on("end", function(){
                    console.log("ffmpeg ended!!!");
                    electronChild.kill();
                    xvfbChildProcess.kill();
                    var m3u8Content = m3u8.M3U.create();
                    m3u8Content.addStreamItem ({
                        uri: recordingFileName+"-desktop"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 2001000,
                        RESOLUTION: "1280x720"
                    });
                    m3u8Content.addStreamItem ({
                        uri: recordingFileName+"-tablet"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 1001000,
                        RESOLUTION: "640x360"
                    });
                    m3u8Content.addStreamItem ({
                        uri: recordingFileName+"-smartphone"+".m3u8",
                        "PROGRAM-ID": 1,
                        BANDWIDTH: 510000,
                        RESOLUTION: "480x320"
                    });
                    fs.writeFile(recordingFilePath+".m3u8", m3u8Content.toString(), null, function(err){
                        if(err === null){
                            ffmpeg.ffprobe(recordingFilePath+".m3u8", function(err, metadata){
                                var db = new PouchDB("http://localhost:5984/"+
                                    msg.teacherTopic.slice(0, msg.teacherTopic.lastIndexOf("-", msg.teacherTopic.length - 1))+
                                    "%2F"+
                                    msg.studentTopics[0].slice(0, msg.studentTopics[0].lastIndexOf("-", msg.studentTopics[0].length - 1)));
                                db.get(msg.docId, null, function(err, result){
                                    result.duration = metadata.format.duration;
                                    result.recordingFileName = recordingFileName;
                                    result.syncStatus = [false, false];
                                    db.put(result, function(){
                                        //TODO: if teacher or student is offline, then don't need to send msg
                                        var replyMsg = {
                                            chat: "NewMessage",
                                            docId: msg.docId,
                                            clientId: msg.studentTopics[0]
                                        };
                                        mqttClientInstance.publish(msg.teacherTopic, JSON.stringify(replyMsg));
                                        replyMsg.clientId = msg.teacherTopic;
                                        mqttClientInstance.publish(msg.studentTopics[0], JSON.stringify(replyMsg));
                                    });
                                });
                            });
                        }
                    });
                })
                .run();
        });
    });
});
/* when got exit signal, then exit
mqttClientInstance.end();
mqttClientInstance = null;
console.log("mqtt client has been destroyed");
*/