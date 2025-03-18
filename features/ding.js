'use strict'

const fs = require("fs"),
{ createCanvas, loadImage, registerFont } = require("canvas");
const tumblr = require('tumblr.js');
const {MessageAttachment} = require('discord.js');

// Load config
const configData = fs.readFileSync("./config.json");
const config = JSON.parse(configData);
const dingBlog = config.tumblr.blog;

const tumblrClient = tumblr.createClient({
    consumer_key: config.tumblr.consumer_key,
    consumer_secret: config.tumblr.consumer_secret,
    token: config.tumblr.token,
    token_secret: config.tumblr.token_secret
});

// Load the template images and the font
const dingImgLoc = "./ding/dingdingding.png";
const templateImg = "ding/BloodborneImage.jpg";
const outputImg = "ding/dingdingding.png";
registerFont("ding/fleshandbloodfont.ttf", { family: "fleshandblood" });

module.exports = {
    helpText: function(){
        return "`/ding <text>` - Create a new ding with the given text and post it to Tumblr\n- `/dingnopost <text>` - Create a new ding with the given text and do not post it to Tumblr"
    },
    isMatch: function(msg){
        const matches = ["/ding ", "/dingnopost "]
        return matches.some(x => msg.startsWith(x));
    },
    doTask: function(msg, message){
        if(msg.startsWith("/ding ")){
            let t = message.content;
            t = t.substring(6).trim();
            console.log("Creating ding png: ", t);
            this.postDing(t, message.channel, true);
        }

        if(msg.startsWith("/dingnopost ")){
            let t = message.content;
            t = t.substring(12).trim();
            console.log("Creating ding png: ", t);
            this.postDing(t, message.channel, false);
        }
    },
    postDing: function(dingText, channel, postToTumblr){
        // Create the new dingdingding
        this.createDing(dingText).then(() => {

            const dingFile = new MessageAttachment(fs.readFileSync(dingImgLoc), 'dingdingding.png');
            channel.send({ files: [dingFile] });
            
            if(postToTumblr){
                this.tumblDing(dingText, channel);
            }
        });
    },
    tumblDing: function(dingText, channel){
    
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
    },
    createDing: function(dingText){
        return new Promise(resolve => {
            
            // Trim whitespace on the end and remove spoiler tags
            dingText = dingText.trim();
            dingText = dingText.replace("||", "");
            let dingArr = [];
            
            // Split dingText 10 chars max per line	
            if (dingText.length > 10){
                let tempArr = dingText.split(/\s+/);
                let builtStr = "";
                
                for(let i = 0; i < tempArr.length; i++){
                    builtStr += " ";
                    builtStr += tempArr[i];
                    
                    
                    if (i >= tempArr.length-1){
                        
                        // Got to the end, push the final string
                        dingArr.push(builtStr.trim());
                        builtStr = "";
                    }
                    else {
                        if(builtStr.length == 10 || (builtStr.length + tempArr[i+1].length > 10)){
                            
                            // Either at length or next word will push over, push the current string
                            dingArr.push(builtStr.trim());
                            builtStr = "";
                        }
                    }
                }
            }
            else {
                dingArr = [dingText]
            }
              
            
            // Load template image
            loadImage(templateImg).then(img => {
              
              // Create the canvas and draw the template image on it 
              const canvas = createCanvas(img.width, img.height);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0);
             
              // Determine font size
              const fontSizes = ['160', '148', '140', '126', '110', '90', '72', '46']
              let fontIndex = 0;
              
              if(dingArr.length >= 5){
                fontIndex = 5;
              }
              else if(dingArr.length >= 4){
                fontIndex = 4;
              }
              else if(dingArr.length >= 3){
                fontIndex = 2;
              }
             
              // Set Text Details
              ctx.font = fontSizes[fontIndex] + 'px "fleshandblood"';
              const transparency = 1;
              ctx.fillStyle = "rgba(255, 255, 255, transparency)";
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = "rgb(0, 0, 0)";
              
              // Drop smaller fonts until the text isnt going to go out of bounds
              for (let i = 0; i < dingArr.length; i++){
                  let currentTD = ctx.measureText(dingArr[i]);
                  let actualTD = currentTD.actualBoundingBoxLeft + currentTD.actualBoundingBoxRight;
                  
                  while(actualTD > (img.naturalWidth - 10) && fontIndex < fontSizes.length){
                      fontIndex++;
                      
                      ctx.font = fontSizes[fontIndex] + 'px "fleshandblood"';
                      currentTD = ctx.measureText(dingArr[i]);
                      actualTD = currentTD.actualBoundingBoxLeft + currentTD.actualBoundingBoxRight;
                  }
              }
              
              // Re-set font 
              ctx.font = fontSizes[fontIndex] + 'px "fleshandblood"';
              
              // Calculate Placement Maths
              const defaultTD = ctx.measureText(dingArr[0]);
              const defaultTH = defaultTD.actualBoundingBoxAscent + defaultTD.actualBoundingBoxDescent;
              const defaultY = Math.floor((img.naturalHeight - defaultTH) / 2.5);
              let y = defaultY;
              dingArr = dingArr.reverse();
              
              // Iterate and draw text, bottom upwards
              for (let i = 0; i < dingArr.length; i++){
                  let td = ctx.measureText(dingArr[i]);
                  let tw = td.width;
                  
                  let x = Math.floor((img.naturalWidth - tw) / 2);
                  
                  ctx.strokeText(dingArr[i], x, y);
                  ctx.fillText(dingArr[i], x, y);
                  y -= defaultTH;
              }
              
              // Write out final image
              const out = fs.createWriteStream(outputImg);
              const stream = canvas.createPNGStream();
              stream.pipe(out);
              
              // Resolve promise once we're done 
              out.on("finish", () => resolve());
            });
        });
    }
}