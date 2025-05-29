'use strict';
const fs = require("fs");
const path = require("path");


// Load config
const configData = fs.readFileSync("./config.json");
const config = JSON.parse(configData);


// Create and load all features
const featureFolder = ".\\features";
const features = {};

fs.readdirSync(featureFolder).forEach(file => {
    let name = file.replace('.js', '');
    features[name] = require(path.resolve(__dirname + '\\features\\' + file));
});


// Generate help text based off loaded features
const helpMenu = [];
let helpText = "- `/help` - List all options and descriptions\n";

for(let feature in features){
    if(features.hasOwnProperty(feature) && features[feature].hasOwnProperty("helpText")) {
        helpMenu.push(features[feature].helpText());
    }
    else console.log(`Feature not loaded: ${feature}`);
}

for(let i = 0; i < helpMenu.length; i++){
    helpText += `- ${helpMenu[i]}\n`;
}


// Setup Discord
const discordChannels = config.discord.channels;
const discordToken = config.discord.token;
const {Client, Intents, Events, GatewayIntentBits } = require('discord.js');
const discClient = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS
] });

discClient.once('ready', () => {
    console.log('Discord Ready!')
});


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


// Pass message to every feature 
function parseMessage(msg, message){
    console.log(msg)
    for(let feature in features){
        if(features.hasOwnProperty(feature)){
            if(features[feature].isMatch(msg)){
                features[feature].doTask(msg, message);
                break;
            }
        }
    }
}

// Discord Message Listener
discClient.on('messageCreate', message => {
    let msg = message.content.toLowerCase()
    if(msg[0] == "." || msg[0] == "/") {
        msg = '/' + msg.substring(1);

        //Get messages from the discord channels
        if(discordChannels.includes(message.channel.id)){

            // Display help message 
            if(msg.startsWith("/help")){
                message.channel.send(helpText);
            }
            else {
                parseMessage(msg, message);
            }
        }
    }


    // Mum check
    const lower = msg.replace("'", "").replace("’", "");
    const matches = ["lizzips mum", "lizzip mum", "lizips mum"];
    let match = false;
    
    for (let i = 0; i < matches.length; i++){
        if(lower.includes(matches[i])) match = true;
    }

    if(match){
        message.react('<:oi:1377241125706010774>')
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
        let msg = `/topic ${t}`;
        parseMessage(msg, {'content': msg});
    }

    if(name == '🏆' || (name === "topic" && topicCount > 1)){
        let t = removeUsername(reaction.message.content);
        t = t.trim();
        t = t.replace("/topic ", '');
        t = t.replace("/point ", '');
        t = t.replace(".topic ", '');
        t = t.replace(".point ", '');

        let msg = `/point ${t}`;
        parseMessage(msg, {'content': msg});
    }
});
discClient.login(discordToken);