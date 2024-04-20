'use strict';

const https = require('https');
const fs = require('fs');


const dumpLoc = "topictourney/all_of_topics.txt";
const tourneyLoc = "topictourney/rankings.txt"


// Download the topics txt file from the URL 
const fetchTopicDump = function(url){

	const file = fs.createWriteStream(dumpLoc);
	const request = https.get(url, function(response) {
	   response.pipe(file);
	
	   // after download completed close filestream
	   file.on("finish", () => {
		   file.close();
		   console.log("Topics downloaded successfully");
	   });
	});

}


// Check if a sentence exists in the topic dump file
const topicExists = function(topic){
    topic = topic.replace(/”/g, '\"');
    topic = topic.replace(/“/g, '\"');
    
    // Open the topic file and store all topics in an array
    let allTopics = fs.readFileSync(dumpLoc).toString().split("\n");
    for(let i = 0; i < allTopics.length; i++){
        allTopics[i] = Buffer.from(allTopics[i], 'utf-8').toString();
    }
    
    return allTopics.indexOf(topic);
}


// Check if a sentence exists in the topic dump file
const rankingExists = function(topic){

    // Open the ranking file and store all topics in an array
    let allRankings = fs.readFileSync(tourneyLoc).toString().split("\n");

    // Remove the score
    for(let i = 0; i < allRankings.length; i++){
        let splitComma = allRankings[i].lastIndexOf(',')
        allRankings[i] = allRankings[i].substring(0, splitComma);
        allRankings[i] = Buffer.from(allRankings[i], 'utf-8').toString();
    }

    return allRankings.indexOf(topic);
}


// Increase the ranking of a topic
const addPoint = function(topic){
    topic = Buffer.from(topic, 'utf-8').toString();

    // First check this is a valid topic 
    if(topicExists(topic) > -1){

        // Load current rankings 
        let rankings = fs.readFileSync(tourneyLoc).toString().split("\n");

        // Check if topic is already in the rankings 
        if(rankingExists(topic) > -1){

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
}

// View current top 10 rankings 
const showTopRankings = function(){

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
    console.log(sortedRankings)

    return sortedRankings.slice(0, 10);
}


exports.fetchTopicDump = fetchTopicDump;
exports.addPoint = addPoint;
exports.showTopRankings = showTopRankings;