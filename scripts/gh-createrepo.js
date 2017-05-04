
module.exports = function(robot) {


  robot.respond(/create repo/i, function(res) {
  	res.reply("creating...")

  	var github = require('octonode');

		/* TODO 
		 * Get Username and password for github account
		 */


		// create a new client
		var client = github.client({
		  username: 'usernane',
		  password: 'password'
		});

		client.get('/user', {}, function (err, status, body, headers) {
			//  json object
		});

		var ghme           = client.me();

		/* TODO 
		 * Get name, description, licence etc for github repo
		 */


		ghme.repo({
		  "name": "Hello-World",
		  "description": "Hello-World repo created using hubot in slack interface",
		}, function(err, data, headers) {
		   console.log("error: " + err);
		   console.log("data: " + data);
		   console.log("headers:" + headers);
		}); //repo


  }) 
} 





