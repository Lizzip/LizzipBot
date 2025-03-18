'use strict'

module.exports = {
    helpText: function(){
        return "`/test` - Test feature, returns a fixed message to show the bot is responding"
    },
    isMatch: function(msg){
        return msg.startsWith("/test ");
    },
    doTask: function(msg, message){
        let t = message.content;
        console.log("testing: ", t);
        message.channel.send('test feature respond');
    }
}