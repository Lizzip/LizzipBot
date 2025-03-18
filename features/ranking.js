'use strict'

const https = require('https');
const fs = require('fs');

const dumpLoc = "topics/all_of_topics.txt";
const tourneyLoc = "topics/rankings.txt"


module.exports = {
    helpText: function(){
        return "`/point <topic>` - Add a point to the given topic\n- `/getpoints <topic>` - Get the current points for the given topic\n- `/ranking` - List the top 10 rankings\n- `/allrankings` - List the top 50 rankings";
    },
    isMatch: function(msg){
        const matches = ["/point ", "/getpoints ", "/ranking", "/allrankings"]
        return matches.some(x => msg.startsWith(x));
    },
    doTask: function(msg, message){
        // Add a point to the given topic 
        if(msg.startsWith("/point ")){
            let t = message.content;
            t = t.substring(7).trim();
            this.addPoint(t);
        }

        // Get the current points for the given topic
        if(msg.startsWith("/getpoints ")){
            let t = message.content;
            t = t.substring(11).trim();
            const points = this.getPoints(t);
            message.channel.send(`"${t}" has ${points} points`);
        }

        // List the top 10 rankings
        if(msg.startsWith("/ranking")){
            const limit = 10
            const top = this.showTopRankings(limit);

            for(let i = 0; i < top.length; i++){
                message.channel.send(`**Rank #${i+1} with a score of ${top[i][1]}** \n${top[i][0]}`);
            }
        }

        // List the top 50 rankings
        if(msg.startsWith("/allrankings")){
            const top = this.showTopRankings(50);
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
                let outputString = [" - " + topics[0][0]];

                // Concat all the topics with this score as a bullet pointed list
                let offset = 0;

                if(topics.length > 1){
                    for(let j = 1; j < topics.length; j++){

                        // Batch the messages into sizes of 10 topics
                        if (j%10 == 0){
                            offset = offset + 1;
                            outputString[offset] = " - " + topics[j][0];
                        }
                        else {
                            outputString[offset] = outputString[offset] + "\n- " + topics[j][0];
                        }
                    }
                }
                
                // Output the messages to discord
                message.channel.send(`**Rank #${i+1} with a score of ${points[i]}:**`);
                for(let k = 0; k < outputString.length; k++){
                    message.channel.send(outputString[k]);
                }
            }
        }
    },
    topicExists: function(topic){
       
        // Open the topic file and store all topics in an array
        let allTopics = fs.readFileSync(dumpLoc).toString().split("\n");
        for(let i = 0; i < allTopics.length; i++){
            allTopics[i] = Buffer.from(allTopics[i], 'utf-8').toString();
        }
        
        return allTopics.indexOf(topic);
    },
    rankingExists: function(topic){

        // Open the ranking file and store all topics in an array
        let allRankings = fs.readFileSync(tourneyLoc).toString().split("\n");
    
        // Remove the score
        for(let i = 0; i < allRankings.length; i++){
            let splitComma = allRankings[i].lastIndexOf(',')
            allRankings[i] = allRankings[i].substring(0, splitComma);
            allRankings[i] = Buffer.from(allRankings[i], 'utf-8').toString();
        }
    
        return allRankings.indexOf(topic);
    },
    addPoint:  function(topic){
        topic = Buffer.from(topic, 'utf-8').toString();

        // First check this is a valid topic 
        if(this.topicExists(topic) > -1){

            // Load current rankings 
            let rankings = fs.readFileSync(tourneyLoc).toString().split("\n");

            // Check if topic is already in the rankings 
            if(this.rankingExists(topic) > -1){

                // topic exists already, increase ranking
                for(let i = 0; i < rankings.length; i++){
                    let splitComma = rankings[i].lastIndexOf(',')
                    if(rankings[i].substring(0, splitComma) == topic){
                        let score = rankings[i].substring(splitComma + 1).trim();
                        score = parseInt(score) + 1;
                        rankings[i] = `${topic}, ${score}`

                        console.log(`Topic already exists, increasing ranking to ${score}!`)
                        break;
                    }
                }

            }
            else {
                // topic is not in rankings, add it to the end and give it 1 point
                rankings.push(`${topic}, 1`)
                console.log("Topic did not exist in rankings, adding topic")
            }

            // Clear the old rankikngs then write out the new ones
            fs.writeFile(tourneyLoc, '', function(){
                const file = fs.createWriteStream(tourneyLoc);
                rankings.forEach(function(v){ 

                    // Don't write out blank lines
                    if(v.length > 0) {
                        file.write(v + '\n')
                    }
                });
                file.end();
                console.log("Updated rankings file")
            });
        }
        else {
            console.log("Topic does not exist: ", topic)
        }
    },
    getPoints: function(topic){

        // Open the ranking file and store all topics and points in an array
        let allRankings = fs.readFileSync(tourneyLoc).toString().split("\n");
        let splitRankings = [];
    
        // Separate the topic and the score
        for(let i = 0; i < allRankings.length; i++){
            let splitComma = allRankings[i].lastIndexOf(',')
            
            // Get topic
            let rankedTopic = allRankings[i].substring(0, splitComma);
            rankedTopic = Buffer.from(rankedTopic, 'utf-8').toString();
    
            // Get points
            let points = allRankings[i].substring(splitComma+1).trim();
            points = parseInt(points);
    
            splitRankings.push([rankedTopic, points]);
        }
    
        // Get the topic points or return 0 if not found
        let returnedPoints = 0
        const tp = splitRankings.filter(x => x[0] == topic)
        if(tp.length > 0) returnedPoints = tp[0][1];
    
        return returnedPoints;
    },
    showTopRankings: function(limit = 0){

        // Open the ranking file and store all topics in an array
        let allRankings = fs.readFileSync(tourneyLoc).toString().split("\n");
        let splitScore = []
    
        // Separate the score
        for(let i = 0; i < allRankings.length; i++){
            if(allRankings[i].length > 0){
                let splitComma = allRankings[i].lastIndexOf(',')
                let topic = allRankings[i].substring(0, splitComma);
                let score = allRankings[i].substring(splitComma + 1).trim();
                score = parseInt(score);
                splitScore.push([topic, score])
            }
        }
    
        // Sort the scores
        const sortedRankings = splitScore.sort((a, b) => b[1] - a[1])
    
        // If no limit was passed return all topics, else only return given amount
        if(limit < 1) return sortedRankings;
        else return sortedRankings.slice(0, limit);
    }
}