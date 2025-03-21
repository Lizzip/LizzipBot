'use strict'
const fs = require("fs");
const dumpLoc = "topics/all_of_topics.txt";

// Generate random int between two numbers
function randomInt(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

module.exports = {
    helpText: function(){
        return "`/random` - Get a random past topic\n- `/search <search_term>` - Search past topics for given term, return one match\n- `/searchall <search_term>` - Search past topics for given term, return all matches";
    },
    isMatch: function(msg){
        const matches = ["/random", "/search ", "/searchall "]
        return matches.some(x => msg.startsWith(x));
    },
    doTask: function(msg, message){
        // Get a random topic
        if(msg.startsWith("/random")){
            let split_file = fs.readFileSync(dumpLoc, 'utf-8').split(/\r?\n/);
            let topic = split_file[randomInt(0,split_file.length-1)];
            message.channel.send(topic);
        }

        // Search topics and return a random one from all matches
        if(msg.startsWith("/search ")){
            let t = message.content;
            t = t.substring(8).trim();
            console.log("Searching for topic: ", t);

            // Find all the matches for the search then return one random one
            const matches = this.getAllMatches(t);
            const topic = matches[randomInt(0,matches.length-1)];
            if(topic) message.channel.send(topic);
            else message.channel.send("Nah, nothing of the sort found");
        }

        // Search topics and return all topics which match
        // Maximum output 50, output random 50 if there are more 
        if(msg.startsWith("/searchall ")){
            let t = message.content;
            t = t.substring(11).trim();
            console.log("Searching for topic: ", t);

            // Remove random matches until we have the maximum amount
            let matches = this.getAllMatches(t);
            while(matches.length > 50){
                matches.splice(Math.floor(Math.random()*matches.length), 1);
            }

            if(matches.length){
                // Split remaining matches into batches of 10
                let sections = []
                while(matches.length > 0){
                    sections.push(matches.splice(0,10));
                }
                
                // Output the batches to Discord
                sections.forEach(s => message.channel.send(s.join('\n')));
            }
            else message.channel.send("Nah, nothing of the sort found");
        }
    },
    getAllMatches: function(searchString){
        let matches = [];

        // Read the entire topic dump file line by line
        fs.readFileSync(dumpLoc, 'utf-8').split(/\r?\n/).forEach(function(line){
            if(line.toLowerCase().includes(searchString.toLowerCase())){
                matches.push(line);
            }
        })

        // Remove duplicates from matches
        const unique_matches = matches.filter(function(elem, pos) {
            return matches.indexOf(elem) == pos;
        })

        return unique_matches;
    }
}