'use strict';
const fs = require("fs");


// Load config
const configData = fs.readFileSync("./config.json");
const config = JSON.parse(configData)


// Import ding
const ding = require('./ding.js')
const dingImgLoc = "./ding/dingdingding.png";


// Setup Tumblr
const dingBlog = config.tumblr.blog;
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


// Discord Message Listener
discClient.on('messageCreate', message => {
    let msg = message.content.toLowerCase()

    //Get messages from the discord channels
    if(discordChannels.includes(message.channel.id)){

        // TOPIC
        if(msg.startsWith("/topic ")){
            let t = message.content;
            t = t.substring(6).trim();
            ircClient.send('TOPIC', ircChannel, t);
            console.log("setting topic: ", t);
        }

        // MARKOV
        if(msg.startsWith(".markov")){
            ircClient.say(ircChannel, ".markov");
            console.log("Markov!");
        }

        //ULTRABUTT MESSAGES
        if(msg.startsWith(".ultrabutt")){
            ircClient.say(ircChannel, message.content);
            console.log(message.content);
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

        // TEST
        if(message.content.startsWith("/test ")){
            let t = message.content;
            console.log("testing: ", t);
			message.channel.send('i respond');
        }
    }
});


// Watch for the TOPIC emoji
discClient.on('messageReactionAdd', (reaction, user) => {

    const name = reaction._emoji.name;
    const id = reaction._emoji.id;

    if(name === "topic"){
        let t = removeUsername(reaction.message.content);
        t = t.trim();
        ircClient.send('TOPIC', ircChannel, t);
        console.log("setting topic: ", t);
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

