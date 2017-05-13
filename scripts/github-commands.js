module.exports = function(robot) {

	'use strict';
	var slackMsgs = require('./slackMsgs.js');				

	/* set Github Account */
	var GitHubApi = require("github");

	var github = new GitHubApi({
	    /* optional */
	    // debug: true,
	    // protocol: "https",
	    // host: "api.github.com", // should be api.github.com for GitHub
	    // //thPrefix: "/api/v3", // for some GHEs; none for GitHub
	    // headers: {
	    //     "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
	    // },
	    // Promise: require('bluebird'),
	    // followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
	    // timeout: 5000
	});


    /* oauth autentication using github personal token */
	github.authenticate({
	    "type": "oauth",
	    "token": process.env.HUBOT_GITHUB_TOKEN
	});

    /* basic autentication using github's username & password */
	// github.authenticate({
	//     type: "basic",
	//     username: '',
	//     password: ''
	// });

	robot.respond(/gh followers (.*)/i, function(res_r) {
		var username = res_r.match[1];

		res_r.reply(username)

		github.users.getFollowersForUser({ 
			"username": username}, 
			function(err,res){
				var jsonsize = Object.keys(res.data).length;

				let menu = slackMsgs.menu();
				let login;
				for (var i = 0; i < jsonsize; i++) {
					login = res.data[i].login;
					menu.attachments[0].actions[0]['options'].push({"text":login,"value":login});
      				//TODO: maybe sort them before display
      			}
      			menu.attachments[0].text = 'Followers of *a*';
      			menu.attachments[0].fallback = '';
      			menu.attachments[0].callback_id = 'followers_cb_id';
      			menu.attachments[0].actions[0].name=' ';
				menu.attachments[0].actions[0].text=' ';

				res_r.reply(menu);
			});	
	})

}
