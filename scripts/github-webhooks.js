var url = require('url');
var querystring = require('querystring');
var slackMsgs = require('./slackMsgs.js')
var color = require('./colors.js')
var Promise = require('bluebird')
var cache = require('./cache.js').getCache()

var githubURL = 'https://www.github.com/'

module.exports = function (robot) {
	robot.router.post('/hubot/github-hooks', function (req, res) {
		var error, eventBody, data;
		try {
			if (false) {
				robot.logger.info("Github post received: ", req);
			}
			eventBody = {
				eventType: req.headers["x-github-event"],
				signature: req.headers["X-Hub-Signature"],
				deliveryId: req.headers["X-Github-Delivery"],
				payload: req.body,
				query: querystring.parse(url.parse(req.url).query)
			};
			res.send('OK');
			webhooksEventsBranching(eventBody);
		} catch (e) {
			// res.send('You supplied invalid JSON to this endpoint.');
			error = e;
			// robot.logger.error('Could not receive github response on github-hooks.js');	
			robot.logger.error("github-hooks.js error: " + error.stack + "\n");
		}
		return res.end("");
	});


	function webhooksEventsBranching(eventBody) {
		switch (eventBody.eventType) {
			case 'push':
				pushEvent(eventBody);
				break;
			case 'deployment':
				developmentEvent(eventBody);
				break;
			case 'deployment_status':
				developmentStatusEvent(eventBody);
				break;
			case 'create':
			case 'delete':
				createAndDeleteEvent(eventBody)
				break
			case 'issues':
				issuesEvent(eventBody);
				break;
			case 'issue_comment':
				issueCommentEvent(eventBody);
				break;
			case 'pull_request':
				pullRequestEvent(eventBody)
				break
			case 'pull_request_review':
				pullRequestReviewEvent(eventBody)
				break
			case 'pull_request_review_comment':
				pullRequestReviewCommentEvent(eventBody)
				break
			case 'fork':
				// is it usefull?
				break;
			case 'pull':
				// is it usefull?
				break;
			default:
				var room = eventBody.query.room
				robot.messageRoom(room, `event: ${eventBody.eventType}`);
				break;
		}
	}

	function pullRequestReviewEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		// NOT HANDLING these type of ACTIONS.
		// Delete them in case of handling them.
		if (payload.action == 'edited' || payload.action == 'dismiss') {
			return 0
		}

		var msg = { attachments: [] }
		var attachment = slackMsgs.attachment()

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url
		var pullReqNum = payload.pull_request.number
		var pullReqURL = payload.pull_request.html_url
		var pullReqTitle = payload.pull_request.title

		var state = payload.review.state
		switch (state) {
			case 'commented':
			case 'changes_requested':
				state = state.split('_').reverse().join(' ')
				attachment.pretext = `<${repoURL}|[${repoFullName}]> <${senderURL}|${senderUsername}> ` +
					`${bold(state)} on pull request <${pullReqURL}|#${pullReqNum}: ${pullReqTitle}> `
				attachment.text = payload.review.body
				attachment.color = 'warning'
				msg.attachments.push(attachment)
				break
			case 'approved':
				state = state.split('_').reverse().join(' ')
				attachment.pretext = `<${repoURL}|[${repoFullName}]> <${senderURL}|${senderUsername}> ` +
					`${bold(state)} pull request <${pullReqURL}|#${pullReqNum}: ${pullReqTitle}> `
				attachment.text = payload.review.body
				attachment.color = 'good'
				msg.attachments.push(attachment)
				break
		}
		attachment.fallback = attachment.pretext

		robot.messageRoom(room, msg)
	}

	function pullRequestReviewCommentEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var msg = { attachments: [] }
		var attachment = slackMsgs.attachment()

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var refType = payload.ref_type //repo, branch or tag 
		var refName = payload.ref
		var refURL = repoURL + '/tree/' + refName
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url

		var action = payload.action
		switch (action) {
			case 'created':

				break
		}
	}

	function issueCommentEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var msg = { attachments: [] }
		var attachment = slackMsgs.attachment()

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var issueURL = payload.issue.html_url
		var issueNum = payload.issue.number
		var issueTitle = payload.issue.title
		var issueType = ''
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url

		var action = payload.action
		switch (action) {
			case 'created':

				if (payload.issue.pull_request) {
					issueType = 'pull request'
				}
				else {
					issueType = 'issue'
				}
				attachment.pretext = `<${repoURL}|[${repoFullName}]> ${bold('New comment')} ` +
					`by <${senderURL}|${senderUsername}> on ${issueType} <${issueURL}|#${issueNum}: ${issueTitle}> `
				attachment.text = payload.comment.body
				attachment.color = color.getHex('gray')
				msg.attachments.push(attachment)
				attachment = slackMsgs.attachment()
				attachment.color = color.getHex('blue')

				if (payload.issue.assignees.length) {
					attachment.fields.push({
						title: 'Assignees:',
						value: getUsersToString(payload.issue.assignees),
						short: true
					})
				}
				msg.attachments.push(attachment)
				robot.messageRoom(room, msg)
				checkForUserMentions(msg, payload.repository.name, issueNum)
				break
			case 'edited':
			case 'deleted':
				// TODO: is it usefull? 
				break
		}
	};

	function checkForUserMentions(msg, repo, issue) {
		var commentText = msg.attachments[0].text
		var regex = /(?:^|\W)@(\w+)(?!\w)/g, match, matches = [];
		while (match = regex.exec(commentText)) {
			var matchedUser = match[1]
			var user = getSlackUser(matchedUser)

			if (user) {
				updateConversationContent(user.id, { github_last_repo: repo, github_last_issue: issue })
				robot.messageRoom(user.id, 'You are mentioned on a Github Issue.')
				robot.messageRoom(user.id, msg)
				robot.messageRoom(user.id, '`github reply <text>` to add a comment to this issue.')

			}

		}
	}


	function createAndDeleteEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var refType = payload.ref_type //repo, branch or tag 
		var refName = payload.ref
		var refURL = repoURL + '/tree/' + refName
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url

		var msg = { attachments: [] };
		var attachment = slackMsgs.attachment()

		if (eventBody.eventType == 'delete') {
			attachment.pretext = `<${repoURL}|[${repoFullName}]> The follow ${refType} was deleted by <${senderURL}|${senderUsername}>`
		}
		else if (eventBody.eventType == 'create') {
			attachment.pretext = `<${repoURL}|[${repoFullName}]> New ${refType} was pushed by <${senderURL}|${senderUsername}>`
		}
		attachment.text = `<${refURL}|${refName}>`
		attachment.color = color.getHex('blue')
		attachment.fallback = attachment.pretext

		msg.attachments.push(attachment)

		robot.messageRoom(room, msg)
	}


	function pullRequestEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var msg = { attachments: [] }
		var attachment = slackMsgs.attachment()

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url
		var pullReqNum = payload.number
		var pullReqURL = payload.pull_request.html_url
		var pullReqTitle = payload.pull_request.title
		var pullReqDescr = payload.pull_request.body

		var action = payload.action // PR's action
		switch (action) {
			case 'opened':
				attachment.pretext = `<${repoURL}|[${repoFullName}]> Pull request submitted by <${senderURL}|${senderUsername}>`
				attachment.title = `<${pullReqURL}|#${pullReqNum} ${pullReqTitle}>`
				attachment.text = pullReqDescr
				var assignees = []
				var reviewers = []
				for (var i = 0; i < payload.pull_request.assignees.length; i++) {
					assignees.push(payload.pull_request.assignees[i].login)
				}
				for (var i = 0; i < payload.pull_request.requested_reviewers.length; i++) {
					reviewers.push(payload.pull_request.requested_reviewers[i].login)
				}
				if (assignees.length) {
					attachment.fields.push({
						title: 'Assignees:',
						value: assignees.toString().replace(/,/g, ', '),
						short: true
					})
				}
				if (reviewers.length) {
					attachment.fields.push({
						title: 'Reviewers:',
						value: reviewers.toString().replace(/,/g, ', '),
						short: true
					})
				}
				attachment.color = 'good'
				break
			case 'closed':
			case 'reopened':
				attachment.pretext = `<${repoURL}|[${repoFullName}]> Pull request ${bold(action)} by <${senderURL}|${senderUsername}>`
				attachment.title = `<${pullReqURL}|#${pullReqNum} ${pullReqTitle}>`
				attachment.text = pullReqDescr
				if (action == 'closed') {
					attachment.color = 'danger'
				}
				else if (action == 'reopened') {
					attachment.color = color.getHex('blue')
				}
				break
			case 'edited':
				var changedElement = ''
				if (payload.changes.base) {
					changedElement = ' the base branch'
				}
				else if (payload.changes.title) {
					changedElement = ' the title'
				}
				attachment.pretext = `<${repoURL}|[${repoFullName}]> <${senderURL}|${senderUsername}> `
					+ `${bold(action + changedElement)} on pull request <${pullReqURL}|#${pullReqNum}: ${pullReqTitle}>`
				break
			case 'assigned':
			case 'unassigned':
				attachment.pretext = `<${repoURL}|[${repoFullName}]> <${senderURL}|${senderUsername}> `
					+ `${bold('changed assignees')} (${action}) on pull request <${pullReqURL}|#${pullReqNum}: ${pullReqTitle}>`
				var assignees = []
				for (var i = 0; i < payload.pull_request.assignees.length; i++) {
					assignees.push(payload.pull_request.assignees[i].login)
				}
				if (assignees.length) {
					attachment.fields.push({
						title: 'Assignees:',
						value: assignees.toString().replace(/,/g, ', '),
						short: false
					})
				}
				attachment.color = color.getHex('blue')
				break
			case 'review_requested':
			case 'review_request_removed':
				var actionText = action.split('_').reverse().toString().replace(/,/g, ' ')

				attachment.pretext = `<${repoURL}|[${repoFullName}]> <${senderURL}|${senderUsername}> `
					+ `${bold(actionText)} on pull request <${pullReqURL}|#${pullReqNum}: ${pullReqTitle}>`
				var reviewers = []
				for (var i = 0; i < payload.pull_request.requested_reviewers.length; i++) {
					reviewers.push(payload.pull_request.requested_reviewers[i].login)
				}
				if (reviewers.length) {
					attachment.fields.push({
						title: 'Reviewers:',
						value: reviewers.toString().replace(/,/g, ', '),
						short: false
					})
				}
				attachment.color = color.getHex('blue')
				break
			default:
				robot.logger.info('pull request event action: ' + action + 'not handled')
				break
		}
		msg.attachments.push(attachment)
		robot.messageRoom(room, msg)
	}


	function pushEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url

		let repoFullName = payload.repository.full_name;
		let branch = payload.repository.default_branch;
		let repoURL = payload.repository.url + '/tree/' + branch;
		let compareURL = payload.compare;
		let commits = Object.keys(payload.commits).length;		 // get the total number of commits done

		let msg = {
			unfurl_links: false,
			attachments: []
		}
		var attachment = slackMsgs.attachment()

		for (var i = 0; i < commits; i++) {
			var authorUsername = payload.commits[i].author.username;
			var authorURL = githubURL + authorUsername;
			var authorName = payload.commits[i].author.name;
			var commitID = payload.commits[i].id.substr(0, 7);		 	// get the first 7 chars of the commit id
			var commitMsg = payload.commits[i].message.split('\n', 1); 	// get only the commit msg, not the description
			var commitURL = payload.commits[i].url;
			commitID = "`" + commitID + "`"
			attachment.text += `\n<${commitURL}|${commitID}> ${commitMsg} - ${authorUsername}`;
		}

		// manage plural
		var s = ''
		if (commits > 1) {
			s = 's'
		}

		if (payload.created) {
			msg.text = `<${repoURL}|[${repoFullName}:${branch}]> ${commits} new <${compareURL}|commit${s}> `
				+ `by <${senderURL}|${senderUsername}>:`
		}
		else if (payload.forced) {
			//TODO
		}
		else if (payload.deleted) {
			// TODO
		}
		else {
			msg.text = `<${repoURL}|[${repoFullName}:${branch}]> ${commits} new <${compareURL}|commit${s}> `
				+ `by <${senderURL}|${senderUsername}>:`
		}

		attachment.color = color.getHex('blue')
		attachment.fallback = msg.text
		msg.attachments.push(attachment)

		robot.messageRoom(room, msg);
	}

	function developmentStatusEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var msg = {
			unfurl_links: false,
			attachments: []
		}
		var attachment = slackMsgs.attachment()

		var targetURL = payload.deployment_status.target_url;
		var repoURL = payload.repository.html_url;
		var state = payload.deployment_status.state;
		var senderUsername = payload.sender.login;
		var senderURL = payload.sender.html_url
		var repo = payload.repository.full_name;
		var environment = payload.deployment.environment;
		msg.text = `<${repoURL}|[${repo}]> created by <${senderURL}|${senderUsername}>`;
		attachment.title = `Deployment ${state}`;
		attachment.text = `<${targetURL}|${environment}>`;
		if (state == 'pending') {
			attachment.color = color.getHex('orange')
		} else if (state == 'success') {
			attachment.color = 'good'
		} else if (state == 'fail') {
			attachment.color = color.getHex('blue')
		} else {
			attachment.color = 'danger'
		}
		msg.attachments.push(attachment)
		robot.messageRoom(room, msg);
	}

	function developmentEvent(eventBody) {
		//TODO 
	};

	function issuesEvent(eventBody) {
		var room = eventBody.query.room
		var payload = eventBody.payload

		var msg = { attachments: [] }
		var attachment = slackMsgs.attachment()

		var repoFullName = payload.repository.full_name
		var repoURL = githubURL + repoFullName
		var senderUsername = payload.sender.login
		var senderURL = payload.sender.html_url
		var issueURL = payload.issue.html_url
		var issueNum = payload.issue.number
		var issueTitle = payload.issue.title
		var issueBody = payload.issue.body

		var action = payload.action
		if (action == 'opened') {
			attachment.pretext = `<${repoURL}|[${repoFullName}]> ${bold('Issue')} created by <${senderURL}|${senderUsername}>`;
			attachment.title = `<${issueURL}|#${issueNum}: ${issueTitle}>`;
			attachment.text = issueBody;
			attachment.color = 'warning'
		}
		else {
			attachment.pretext = `<${repoURL}|[${repoFullName}]> ${bold('Issue')} <${issueURL}|#${issueNum}: ` +
				`${issueTitle}> ${bold(action)} by <${senderURL}|${senderUsername}>`
		}
		attachment.fallback = attachment.pretext

		// assign attachment color 
		// CURRENTLY WE ARE NOT USING attachmentS FOR ALL ISSUES SO IT'S USELESS
		// 	if (action.includes('open')){
		// 		attachment.color = '#00ff00'; // set color = green
		// 	} else if (action.includes('close')){
		// 		attachment.color = '#ff0000'; // set color = red
		// 	} else {
		// 		attachment.color = '#ff8533'; // set color = orange
		// 	} 

		msg.attachments.push(attachment)

		robot.messageRoom(room, msg)

	};


	/*************************************************************************/
	/*                          helpful functions                            */
	/*************************************************************************/

	function getSlackUser(githubUsername) {

		var userids = cache.get('userIDs')

		for (var i = 0; i < userids.length; i++) {
			var id = userids[i]

			var user = cache.get(id)
			var cachedGithubUsername
			try {
				var cachedGithubUsername = user.github_username
				if (cachedGithubUsername == githubUsername) {
					return robot.brain.userForId(id)
				}
			} catch (e) {

			}
			return false
		}
	}


	function bold(text) {
		if (robot.adapterName == 'slack') {
			return `*${text}*`
		}
		// Add any other adapters here  
		else {
			return text
		}
	}

	function getUsersToString(usersArray) {
		var usersString = []
		for (var i = 0; i < usersArray.length; i++) {
			usersString.push(usersArray[i].login)
		}
		return usersString.toString().replace(/,/g, ', ')

	}

	function updateConversationContent(userid, content) {
		cache.set(userid, { content: content })
	}

	function getConversationContent(userid, key) {
		try {
			var content = cache.get(userid, content)[key]
			if (!content) {
				throw 'content ' + key + ' for userid ' + userid + ' not found.'
			} else {
				return content
			}
		} catch (error) {
			return false
		}
	}

}
