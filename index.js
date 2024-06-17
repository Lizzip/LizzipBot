'use strict';
const fs = require("fs");
const http =  require("https")
const html = require("html-entities")


// Load config
const configData = fs.readFileSync("./config.json");
const config = JSON.parse(configData)


// Import ding
const ding = require('./ding.js')
const dingImgLoc = "./ding/dingdingding.png";


// Import topic tourney
const tourney = require('./topictourney.js')


// Setup Tumblr
const dingBlog = config.tumblr.blog;
const topicBlog = config.tumblr.topics;
const randomTopic = config.tumblr.random_topics;
const tumblr = require('tumblr.js');
const tumblrClient = tumblr.createClient({
    consumer_key: config.tumblr.consumer_key,
    consumer_secret: config.tumblr.consumer_secret,
    token: config.tumblr.token,
    token_secret: config.tumblr.token_secret
});


// Setup Discord
const discordChannels = config.discord.channels;
const discordToken = config.discord.token;
const {Client, Intents, Events, MessageAttachment, GatewayIntentBits } = require('discord.js');
const discClient = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS
] });

discClient.once('ready', () => {
    console.log('Discord Ready!')
});


// Setup IRC
const irc = require('irc');
const ircChannel = config.irc.channel;
const ircClient = new irc.Client(config.irc.server, config.irc.username, {
   channels: [ircChannel],
    port: config.irc.port
});
ircClient.addListener('error', message => console.log('error: ', message));


// Remove IRC relay usernames from messages
const removeUsername = str => {

    // IRC
    if(str.startsWith("<")){
        const e = str.indexOf(">");

        if(e > -1){
            return str.substring(e+1);
        }
    }
    else if(str.startsWith("**<")){
        const e = str.indexOf(">**");

        if(e > -1){
            return str.substring(e+3);
        }
    }

    return str;
}

// Generate random int between two numbers
function randomInt(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}


// Discord Message Listener
discClient.on('messageCreate', message => {
    let msg = message.content.toLowerCase()

    //Get messages from the discord channels
    if(discordChannels.includes(message.channel.id)){

        // Test command
        if(message.content.startsWith("/test ")){
            let t = message.content;
            console.log("testing: ", t);
            message.channel.send('i respond');
        }


        ///////////////////////////// IRC /////////////////////////////

        // Set a topic in IRC
        if(msg.startsWith("/topic ") || msg.startsWith(".topic ")){
            let t = message.content;
            t = t.substring(6).trim();
            ircClient.send('TOPIC', ircChannel, t);
            console.log("setting topic: ", t);

            // Wait for 3 seconds then download the full topics dump txt
            (async function() {
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
                await sleep(3000)
                downloadTopics(t);
            })()
        }

        // Call MARKOV in IRC
        if(msg.startsWith(".markov")){
            ircClient.say(ircChannel, ".markov");
            console.log("Markov!");
        }

        // Forward an ultrabutt message to IRC
        if(msg.startsWith(".ultrabutt")){
            ircClient.say(ircChannel, message.content);
            console.log(message.content);
        }


        ///////////////////////////// TUMBLR /////////////////////////////
        
        // Get a random past topic from Tumblr
        if(msg.startsWith(".random")){
            console.log("Getting random topic");
            getRandomTopic(message.channel)
        }
        
        // Search for a past topic from Tumblr and output one
        if(msg.startsWith(".search ")){
            let t = message.content;
            t = t.substring(8).trim();
            console.log("Searching for topic: ", t);
            searchTopic(t, message.channel);
        }

        // Search for a past topic from Tumblr and output all found
        if(msg.startsWith(".searchall ")){
            let t = message.content;
            t = t.substring(11).trim();
            console.log("Searching for topic: ", t);
            searchTopic(t, message.channel, true);
        }

        //DINGDINGDING
        if(msg.startsWith(".ding ")){
            let t = message.content;
            t = t.substring(6).trim();
            console.log("Creating ding png: ", t);
            postDing(t, message.channel, true);
        }

        //DINGDINGDING without posting to tumblr
        if(msg.startsWith(".dingnopost ")){
            let t = message.content;
            t = t.substring(12).trim();
            console.log("Creating ding png: ", t);
            postDing(t, message.channel, false);
        }


        ///////////////////////////// TOPIC RANKINGS /////////////////////////////

        // Download the full topic txt file 
        if(msg.startsWith("/fetchtopics") || msg.startsWith(".fetchtopics")){
            downloadTopics();
        }

        // Force a point to a topic ranking
        if(msg.startsWith("/point ") || msg.startsWith(".point ")){
            let t = message.content;
            t = t.substring(7).trim();
            tourney.addPoint(t)
        }

        // Force a point to a topic ranking
        if(msg.startsWith("/getpoints ") || msg.startsWith(".getpoints ")){
            let t = message.content;
            t = t.substring(11).trim();
            const points = tourney.getPoints(t);
            message.channel.send(`"${t}" has ${points} points`);
        }

        // Output the top 10 topic rankings
        if(msg.startsWith("/ranking") || msg.startsWith(".ranking")){
            topTopics(message.channel);
        }

        // Output all ranked topics 
        if(msg.startsWith("/allrankings") || msg.startsWith(".allrankings")){
            allTopTopics(message.channel);
        }
    }
});


// Watch for the TOPIC or TROPHY emoji
discClient.on('messageReactionAdd', (reaction, user) => {

    const name = reaction._emoji.name;
    const id = reaction._emoji.id;
    const topicEmojiId = "1035917555841384498";
    let topicCount = 0;

    //console.log(reaction.message.reactions.cache)

    // If its the TOPIC emote, set a topic (but only if its the first time the topic emote has been added to this post)
    if(reaction.message.reactions.cache.get(topicEmojiId)){
        topicCount = reaction.message.reactions.cache.get(topicEmojiId).count
        console.log("Topic emoji count: ", topicCount)
    }

    if(name === "topic" && topicCount == 1){
        let t = removeUsername(reaction.message.content);
        t = t.trim();
        ircClient.send('TOPIC', ircChannel, t);
        console.log("setting topic: ", t);

        // Wait for 3 seconds then download the full topics dump txt
        (async function() {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
            await sleep(3000)
            downloadTopics(t);
        })()
    }

    // If it's the TROPY emote then add to topic rankings
    if(name == '🏆' || (name === "topic" && topicCount > 1)){
        let t = removeUsername(reaction.message.content);
        t = t.trim();
        t = t.replace("/topic ", '');
        t = t.replace(".point ", '');
        tourney.addPoint(t);
        console.log("adding point ", t)
    }

});
discClient.login(discordToken);


// Post the last generated Ding to Tumblr
const tumblDing = function(dingText, channel){
    
    //Convert ding png to base64
    const img = fs.readFileSync(dingImgLoc);
    const imgBuffer = Buffer.from(img).toString('base64');
    
    let params = {
        'data64': imgBuffer,
        'caption': dingText
    }
    
    tumblrClient.createPhotoPost(dingBlog, params, (err, response) => {
        console.log(err);
        console.log(response);

        if(!err){
            channel.send(`Ding posted to https://${config.tumblr.blog}`); 
        }
    });
}


// Create a Ding and post it to Discord
const postDing = function(dingText, channel, postToTumblr){
    
    // Create the new dingdingding
    ding.createDing(dingText).then(() => {

        const dingFile = new MessageAttachment(fs.readFileSync(dingImgLoc), 'dingdingding.png');
        channel.send({ files: [dingFile] });
        
        if(postToTumblr){
            tumblDing(dingText, channel);
        }
    });
}

const getRandomTopic = function(channel) {
    
    // Make request to the tumblr/random endpoint then use the post ID in the redirect URL
     http.get(randomTopic, res => {
        let redirectData = ''
        
        res.on('data', chunk => {
            redirectData += chunk
        })
        
        res.on('end', () => {
            let redirect = res.headers.location
            console.log("Redirecting to: ", redirect)
            
            let regex = /post\/[0-9]*\//gm
            let id = redirect.match(regex)[0];
            id = id.replace("post", '');
            id = id.replaceAll("/", '');

            let params = {'id': id}
            
            tumblrClient.blogPosts(topicBlog, params, (err, response) => {    
                console.log(err)
                if(!err) channel.send(response.posts[0].title);
            });

        })
    }); 
}


const recursiveTopicGet = function(url, searchString, pageNum, topics, channel, callback){
    let regex = /<h2 class="post-title">.*<\/h2>/gm

    // Only query up to 10 pages
    if(pageNum <= 10){
        if(pageNum >= 2) url = `https://${topicBlog}/search/${searchString}/page/${pageNum}`;
        let m = [];
        console.log(`Getting URL: ${url}`)

        http.get(url, res => {
            let data = ''
        
            res.on('data', chunk => {
                data += chunk
            })
            
            res.on('end', () => {
                const matches = [...data.matchAll(regex)];
                
                matches.forEach(function(part, index) {
                    let t = matches[index][0];
                    t = t.replace('<h2 class="post-title">', '');
                     t = t.replace('</h2>', '');
                     t = html.decode(t);
                    m.push(t);
                });

                let uniqueMatches = m.filter(function(elem, pos) {
                    return m.indexOf(elem) == pos;
                });

                topics = uniqueMatches.concat(topics);
                pageNum = pageNum += 1;

                // Check if we've hit the final page of the search, call again if not, output topics if we have
                if(topics.indexOf("Sorry, no posts found") > -1 || pageNum > 9){
                    topics = topics.filter(x => x !== "Sorry, no posts found");
                    topics = topics.map(i => '- ' + i);

                    if(topics.length > 0){
                        // Spit out 10 topics at a time
                        let sections = []
                        while(topics.length > 0){
                            sections.push(topics.splice(0,10));
                        }
                        
                        sections.forEach(s => channel.send(s.join('\n')));
                    }
                    else channel.send("Nah, nothing of the sort found")
                }
                else {
                    return callback(url, searchString, pageNum, topics, channel, recursiveTopicGet)
                }
            });
        }); 
        
    }
}


const searchTopic = function(search, channel, searchall){

    // Make search request to tumblr/search endpoint then use the post
    let searchString = search.replaceAll(" ", "+");
    let regex = /<h2 class="post-title">.*<\/h2>/gm
    let firstUrl = `https://${topicBlog}/search/${searchString}`;
    let pageNum = 1;
    
    if(searchall){
        recursiveTopicGet(firstUrl, searchString, pageNum, [], channel, recursiveTopicGet)
    }
    else {
        http.get(firstUrl, res => {
            let data = ''
        
            res.on('data', chunk => {
                data += chunk
            })
            
            res.on('end', () => {
                const matches = [...data.matchAll(regex)];
                const rand = randomInt(0, matches.length-1);
                console.log("Rand:", rand)
                console.log("Max matches", matches.length-1);
                
                let t = matches[rand][0];
                t = t.replace('<h2 class="post-title">', '');
                t = t.replace('</h2>', '');
                t = html.decode(t);
                channel.send(t);
            });
        }); 
    }
}

// Call the download topics function in the topictourney module 
const downloadTopics = function(t){
    const url = config.misc.topic_dump_url;
    tourney.fetchTopicDump(url, t)
}

// Output the top 10 rated topics 
const topTopics = function(channel){
    const limit = 10
    const top = tourney.showTopRankings(limit);

    for(let i = 0; i < top.length; i++){
        channel.send(`**Rank #${i+1} with a score of ${top[i][1]}** \n${top[i][0]}`);
    }
}

// Output every ranked topic 
const allTopTopics = function(channel){
    const top = tourney.showTopRankings();
    let points = [];

    // Iterate the topic scores and gather all unique scores 
    for(let i = 0; i < top.length; i++){
        if(!points.includes(top[i][1])){
            points.push(top[i][1])
        }
    }

    // Output all topics at once for each unique score
    for(let i = 0; i < points.length; i++){

        let topics = top.filter(t => t[1] == points[i])
        let outputString = " - " + topics[0][0];

        // Concat all the topics with this score as a bullet pointed list
        if(topics.length > 1){
            for(let j = 1; j < topics.length; j++){
                outputString = outputString.concat("\n- ", topics[j][0]);
            }
        }
        
        channel.send(`**Rank #${i+1} with a score of ${points[i]}:**`);
        channel.send(outputString);
    }
}