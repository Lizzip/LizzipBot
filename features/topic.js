'use strict'
const fs = require("fs");
const https = require('https');
const tumblr = require('tumblr.js');

// Load config
const configData = fs.readFileSync("./config.json");
const config = JSON.parse(configData);
const dumpLoc = "topics/all_of_topics.txt";

// Setup IRC
const irc = require('irc');
const ircChannel = config.irc.channel;
const ircClient = new irc.Client(config.irc.server, config.irc.username, {
   channels: [ircChannel],
    port: config.irc.port
});
ircClient.addListener('error', message => console.log('error: ', message));

// Setup Tumblr
const topicBlog = config.tumblr.topic.blog;
const tumblrClient = tumblr.createClient({
    consumer_key: config.tumblr.topic.consumer_key,
    consumer_secret: config.tumblr.topic.consumer_secret,
    token: config.tumblr.topic.token,
    token_secret: config.tumblr.topic.token_secret
});

module.exports = {
    helpText: function(){
        return "`/topic <topic>` - Set a new topic or add a point to an existing topic\n- `/markov` - Create a markov in IRC\n- `/ultrabutt` - pass a message to Ultrabutt in IRC";
    },
    isMatch: function(msg){
        const matches = ["/topic ", "/markov", "/ultrabutt"]
        return matches.some(x => msg.startsWith(x));
    },
    doTask: function(msg, message){
        
        if(msg.startsWith("/topic ")){
            let t = message.content;
            t = t.substring(6).trim();

            // Set a topic in IRC
            ircClient.send('TOPIC', ircChannel, t);
            console.log("setting topic: ", t);

            // Send the topic to Tumblr
            const dt = new Date().toString().replace(/T/, ' ').replace(/\(\d)T(\d)/, '');

            let params = {
                'title': t,
                'body': `This topic was set at ${dt}`
            }

            tumblrClient.createTextPost(topicBlog, params, (err, response) => {
                if (err) {
                    console.log(err)
                }
            });

            // Wait for 3 seconds then download the full topics dump txt
            const self = this;
            (async function() {
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
                await sleep(3000)
                self.downloadTopics(t)
            })();
        }

        // Call MARKOV in IRC
        if(msg.startsWith("/markov")){
            ircClient.say(ircChannel, ".markov");
            console.log("Markov!");
        }

        // Forward an ultrabutt message to IRC
        if(msg.startsWith("/ultrabutt")){
            ircClient.say(ircChannel, message.content.replace('/ultrabutt', '.ultrabutt'));
            console.log(message.content);
        }
    },
    downloadTopics: function(topic){
        const file = fs.createWriteStream(dumpLoc);
        https.get(config.misc.topic_dump_url, function(response) {
           response.pipe(file);
        
           // after download completed close filestream
           file.on("finish", () => {
                file.close();
                console.log("Topics downloaded successfully");
    
                // If we passed a new topic add it to the file too
                if(topic){
                    fs.appendFile(dumpLoc, topic, function (err) {
                        if(err) console.log(err);
                    });
                }
           });
        });
    }
}




        