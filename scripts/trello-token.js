module.exports = function(robot) {

  	robot.respond(/trello get token/i, function(res_r) {
	
		var slackMsgs = require('./slackMsgs.js');				

		var key = process.env.HUBOT_TRELLO_KEY;

		var scope = 'read,write,account';
		var name = 'Hubot';
		var expr = '30days';
		var cb_method = '';
		var return_url = '';
		var url = `https://trello.com/1/authorize?expiration=${expr}&name=${name}&scope=${scope}&key=${key}&response_type=token`;

		var msg = slackMsgs.basicMessage();

		msg.attachments[0].pretext = "Please get a token to authorize your Trello account";
		msg.attachments[0].title = "Trello Token"; 
		msg.attachments[0].title_link = url; 
		msg.attachments[0].text = "Copy the token from the link above and run\n *trello add token <YOUR TOKEN>*";
		msg.attachments[0].footer = "Trello";
		msg.attachments[0].footer_icon = "https://d2k1ftgv7pobq7.cloudfront.net/meta/u/res/images/b428584f224c42e98d158dad366351b0/trello-mark-blue.png";
		res_r.send(msg);
	})



  	robot.respond(/trello add token (.*)/i, function(res_r) {
  		var token = res_r.match[1];
  		process.env.HUBOT_TRELLO_TOKEN = token;
  		//TODO: add tokens based on user
  	})
}