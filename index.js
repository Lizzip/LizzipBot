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

        // SET TOPIC IN IRC
        if(msg.startsWith("/topic ") || msg.startsWith(".topic ")){
            let t = message.content;
            t = t.substring(6).trim();
            ircClient.send('TOPIC', ircChannel, t);
            console.log("setting topic: ", t);
        }
		
		// GET RANDOM PAST TOPIC FROM TUMBLR
		if(msg.startsWith(".random")){
			console.log("Getting random topic");
			getRandomTopic(message.channel)
        }
		
		// SEARCH FOR PAST TOPIC FROM TUMBLR
		if(msg.startsWith(".search ")){
			let t = message.content;
			t = t.substring(8).trim();
			console.log("Searching for topic: ", t);
			searchTopic(t, message.channel);
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

    //console.log(reaction.message.reactions.cache)

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
				
				if(!err){
					channel.send(response.posts[0].title);
				}
			});

		})
	}); 
}


const searchTopic = function(search, channel){

	// Make search request to tumblr/search endpoint then use the post
	let searchString = search.replaceAll(" ", "+");
	let url = `https://${topicBlog}/search/${searchString}`;
	let regex = /<h2 class="post-title">.*<\/h2>/gm
	
	http.get(url, res => {
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