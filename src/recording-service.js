/**
 * Created by khejing on 2015/6/30.
 */

var mqtt =require('mqtt');

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
});
/* when got exit signal, then exit
mqttClientInstance.end();
mqttClientInstance = null;
console.log("mqtt client has been destroyed");
*/