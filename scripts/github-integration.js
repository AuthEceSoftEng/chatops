// Commands:
//	 `github login`
//	 `github repos`
//	 `github (last <num>) (open|closed|all|mentioned) issues of repo <repo_name>`
//	 `github comments issue <num> repo <repo>`
//	 `github (open|closed|all) pull requests repo <repo>` - Default: open
//	 `github (open|closed|all) pull requests all repos`
//	 `github (last <num>) commits repo <repo>`
//	 `github create|open issue`
// 	 `github repo <repo> create issue <title> `
// 	 `github repo <repo> issue <num> add comment`
// 	 `github reply <comment>` - reply instantly to the last issue comment you've been mentioned
//	 `github close` - instanlty close the last issue you've been mentioned
// 	 `github sumup (open|closed|all)(since)`
// 	 `github close|reopen issue <num> repo <repo>`


'use strict';

// init
const querystring = require('querystring')
var GitHubApi = require("github")
var slackMsgs = require('./slackMsgs.js')
var c = require('./config.json')
var encryption = require('./encryption.js')
var cache = require('./cache.js').getCache()
const Conversation = require('./hubot-conversation/index.js')
var dialog = require('./dynamic-dialog.js')
var convModel = require('./conversation-models.js')
var color = require('./colors.js')
var path = require('path')
var async = require('async')
var dateFormat = require('dateformat')
var request = require('request-promise')
var Promise = require('bluebird')
var mongoskin = require('mongoskin')
Promise.promisifyAll(mongoskin)

// config
var mongodb_uri = process.env.MONGODB_URI
var bot_host_url = process.env.HUBOT_HOST_URL;
var GITHUB_API = 'https://api.github.com'
var githubURL = 'https://www.github.com/'

module.exports = function (robot) {

	/*************************************************************************/
	/*                             Listeners                                 */
	/*************************************************************************/

	var switchBoard = new Conversation(robot);

	robot.respond(/github login/, function (res) {
		oauthLogin(res.message.user.id)
	})

	robot.on('githubOAuthLogin', function (res) {
		oauthLogin(res.message.user.id)
	})

	robot.on('githubApiaiLogin', function ({ }, res) {
		oauthLogin(res.message.user.id)
	})



	robot.respond(/github repos/, (res) => {
		listRepos(res.message.user.id)
	})

	robot.on('listGithubRepos', (data, res) => {
		listRepos(res.message.user.id)
	})



	robot.respond(/github( last (\d+)|) (open |closed |all |mentioned |)issues?( of)? repo (.*)/i, function (res) {
		var repo = res.match.pop().replace(/"/g, '')
		var issuesCnt = res.match[2]
		var parameter = res.match[3].trim()
		listGithubIssuesListener(res, repo, parameter, issuesCnt)
	})

	robot.on('listGithubIssues', (data, res) => {
		var repo = data.parameters.repo
		var issuesCnt = data.parameters.issuesCnt
		var parameter = data.parameter.status
		listGithubIssuesListener(res, repo, parameter, issuesCnt)
	})

	function listGithubIssuesListener(res, repo, parameter, issuesCnt) {
		var userid = res.message.user.id
		if (parameter == 'mentioned') {
			var paramsObj = { mentioned: getCredentials(userid).username }
		}
		else if (parameter != '') {
			paramsObj = { state: parameter }
		}
		// NOT SURE ABOUT THIS ONE: updateConversationContent(userid, { github_repo: repo })
		listRepoIssues(userid, repo, paramsObj, issuesCnt)
	}



	robot.respond(/github comments( of)? issue (\d+)( of)? repo (.*)/i, function (res) {
		var repo = res.match.pop().replace(/"/g, '')
		var issueNum = res.match[2]//.trim()
		githubIssueCommentsListener(res, issueNum, repo)
	})

	// api.ai dysfunctions with this one
	robot.on('listGithubIssueComments', (data, res) => {
		var repo = data.parameters.repo
		var issueNum = data.parameters.issueNum
		githubIssueCommentsListener(res, issueNum, repo)
	})

	function githubIssueCommentsListener(res, issueNum, repo) {
		var userid = res.message.user.id
		// NOT SURE ABOUT THIS updateConversationContent(userid, { github_repo: repo, github_issue: issueNum })
		listIssueComments(userid, issueNum, repo)
	}



	robot.respond(/github (open |closed |all |)pull requests( of)? repo (.*)/i, function (res) {
		var state = res.match[1].trim()
		var repo = res.match[2].trim()
		listGithubPullRequestsListener(res, repo, state)
	})

	// api.ai disabled
	robot.on('listGithubPullRequests', (data, res) => {
		var state = data.parameters.state.replace(/"/g, '')
		var repo = data.parameters.repo.replace(/"/g, '')
		listGithubPullRequestsListener(res, repo, state)
	})

	function listGithubPullRequestsListener(res, repo, state) {
		var userid = res.message.user.id
		listPullRequests(userid, repo, state)
	}



	robot.respond(/github (open |closed |all |)pull requests( of)? all repos/i, function (res) {
		var state = res.match[1].trim()
		listGithubPullRequestsAllReposListener(res, state)
	})

	robot.on('listGithubPullRequestsAllRepos', (data, res) => {
		var state = data.parameters.state
		listGithubPullRequestsAllReposListener(res, state)
	})

	function listGithubPullRequestsAllReposListener(res, state) {
		var userid = res.message.user.id
		listPullRequestsForAllRepos(userid, state)
	}



	robot.respond(/github( last (\d+)|) commits( of)?( repo)? (.*)/i, function (res) {
		var repo = res.match.pop().trim()
		var commitsCnt = res.match[2]
		var userid = res.message.user.id
		// updateConversationContent(userid, { repo: repo })
		listRepoCommits(userid, repo, commitsCnt)
	})

	// api.ai disabled
	robot.on('listGithubRepoCommits', function (data, res) {
		var userid = res.message.user.id
		var commitsCnt = data.parameters.commitsCnt
		var repo = data.parameters.repo
		listRepoCommits(userid, repo)
	})



	// could be replaced with api.ai
	robot.respond(/\bgithub\s(create|open)\sissue\b$/i, function (res) {
		var userid = res.message.user.id
		dialog.startDialog(switchBoard, res, convModel.createIssue)
			.then(data => {
				createIssue(userid, data.repo, data.title, data.body)
			})
			.catch(error => {
				res.reply(error.message)
				robot.logger.error(error)
			})
	})

	robot.respond(/github repo (.*) create issue (.*)/i, function (res) {
		var userid = res.message.user.id
		var repo = res.match[1]
		var title = res.match[2]
		res.reply('Describe the issue:')
		var dialog = switchBoard.startDialog(res, 1000 * 60 * 5) // 5 minutes timeout 
		dialog.addChoice(/ ((.*\s*)+)/i, function (res) {
			var issueBody = res.match[1]
			createIssue(userid, repo, title, issueBody)
		})
	})

	// api.ai disabled
	robot.on('createGithubIssue', (data, res) => {
	})



	robot.respond(/github repo (.*) issue (\d+)( add)? comment/i, function (res) {
		var userid = res.message.user.id
		var issueNum = res.match[2]
		var repo = res.match[1]
		res.reply('Add your comment here:')
		var dialog = switchBoard.startDialog(res, 1000 * 60 * 10)
		dialog.addChoice(/ ((.*\s*)+)/i, function (res) {
			var commentText = res.match[1]
			createIssueComment(userid, repo, issueNum, commentText)
		})

	})

	// api.ai disabled
	robot.on('addGithubIssueComment', (data, res) => {
	})



	// reply instantly to the last github issue mentioned
	robot.respond(/github reply (.*)/i, function (res) {
		var userid = res.message.user.id
		var commentText = res.match[1]
		try {
			var repo = getConversationContent(userid, 'github_last_repo')
			var issue = getConversationContent(userid, 'github_last_issue')
			if (repo && issue) {
				createIssueComment(userid, repo, issue, commentText)
			} else {
				throw null
			}
		} catch (error) {
			robot.messageRoom(userid, 'Sorry but i couldn\'t process your query.')
		}
	})


	// close an issue instantly to the last github issue mentioned
	robot.respond(/\bgithub close$\b/i, function (res) {
		var userid = res.message.user.id
		var commentText = res.match[1]
		try {
			var repo = cache.get(userid).github_last_repo
			var issue = cache.get(userid).github_last_issue
			if (repo && issue) {
				updateIssue(userid, repo, issue, { state: 'close' })
			} else {
				throw null
			}
		} catch (error) {
			robot.messageRoom(userid, 'Sorry but i couldn\'t process your query.')
		}
	})



	robot.respond(/\bgithub sum-?ups?( all| closed| open|)( since|)\b$/i, function (res) {
		var userid = res.message.user.id
		var queryObj = {}
		var state = res.match[1].trim()
		var since = res.match[2].trim()
		var saveDate = false
		if (since) {
			saveDate = true
			var lastGithubSumupDate = cache.get(userid, 'github_last_sumup_date')
			if (!lastGithubSumupDate) {
				var date = new Date()
				var yesterday = new Date(date.setDate(date.getDate() - 1)).toISOString()
				queryObj.since = yesterday

			} else {
				queryObj.since = lastGithubSumupDate
			}
		}
		if (state != null) {
			queryObj.state = state
		}
		else {
			queryObj.state = 'open'
		}
		listGithubSumUp(res.message.user.id, queryObj, saveDate)
	})

	// api.ai disabled
	robot.on('listGithubSumup', (data, res) => {
		var userid = res.message.user.id
	})



	robot.respond(/github (close |r?e?-?open )issue (\d+) repo (.*)/i, function (res) {
		var userid = res.message.user.id
		var repoName = res.match[3].trim()
		var issueNum = parseInt(res.match[2])
		var state = res.match[1].trim()
		if (state.includes('open')) {
			state = 'open'
		} else {
			state = 'closed'
		}
		updateIssue(userid, repoName, issueNum, { state: state })
	})

	// api.ai disabled
	robot.on('changeGithubIssueStatus', function(data, res){

	})


	robot.on('githubSumUp', function (userid, query, saveLastSumupDate) {
		listGithubSumUp(userid, query, saveLastSumupDate)
	})

	/*************************************************************************/
	/*                             API Calls                                 */
	/*************************************************************************/
	function createIssueComment(userid, repo, issueNum, comment) {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var dataString = { body: comment }
		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNum}/comments`,
			method: 'POST',
			body: dataString,
			headers: getUserHeaders(cred.token),
			json: true
		}

		request(options)
			.then(r => {
				robot.messageRoom(userid, `Comment added on issue #${issueNum} of repo ${repo}!`)
			})
			.catch(error => {
				robot.logger.error(error.error)
				robot.messageRoom(userid, error.error)
			})
	}

	function updateIssue(userid, repo, issueNum, updateObj) {
		var ghApp = cache.get('GithubApp')
		var owner = ghApp[0].account

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNum}`,
			method: 'PATCH',
			headers: getUserHeaders(cred.token),
			body: updateObj,
			json: true
		}

		request(options).then(res => {
			var updateInfo = `${Object.keys(updateObj)}: ${updateObj[Object.keys(updateObj)]}`
			var msg = { unfurl_links: true }
			msg.text = `Issue <${res.html_url}|#${res.number}: ${res.title}> updated. ${updateInfo}.`
			robot.messageRoom(userid, msg)
		}).catch(error => {
			robot.messageRoom(userid, error.message)
			robot.logger.error(error)
		})


	}

	function listPullRequestsForAllRepos(userid, state) {
		getAccesibleReposName(userid)
			.then(repos => {
				for (var i = 0; i < repos.length; i++) {
					listPullRequests(userid, repos[i], state)
				}
			})
			.catch(error => {
				robot.messageRoom(user, c.errorMessage)
				robot.logger.error(error)
			})
	}

	function listGithubSumUp(userid, query, saveLastSumupDate = false) {
		var ghApp = cache.get('GithubApp')
		var orgName = ghApp[0].account

		var credentials = getCredentials(userid)
		if (!credentials) { return 0 }

		if (saveLastSumupDate) {
			var date = new Date().toISOString()
			cache.set(userid, { github_last_sumup_date: date })

			var db = mongoskin.MongoClient.connect(mongodb_uri);
			db.bind('users').findAndModifyAsync(
				{ _id: userid },
				[["_id", 1]],
				{ $set: { github_last_sumup_date: date } },
				{ upsert: true })
				.catch(error => {
					robot.logger.error(error)
					if (c.errorsChannel) {
						robot.messageRoom(c.errorsChannel, c.errorMessage
							+ `Script: ${path.basename(__filename)}`)
					}
				})
		}

		getAccesibleReposName(userid)
			.then(repos => {
				var sinceText = ''
				if (query.since) {
					sinceText = ` since *${dateFormat(new Date(query.since), 'mmm dS yyyy, HH:MM')}*`
				}
				robot.messageRoom(userid, `Here is your github summary${sinceText}:`)
				for (var i = 0; i < repos.length; i++) {
					var repoName = repos[i]
					Promise.mapSeries([
						`<${githubURL}${orgName}/${repoName}|[${orgName}/${repoName}]>`,
						getCommitsSumup(userid, repoName, query.since),
						getIssuesSumup(userid, repoName, query.state, query.since),
						getPullRequestsSumup(userid, repoName, query.state)
					], function (sumupMsg) {
						return sumupMsg
					}).then(function (data) {
						var msg = {
							unfurl_links: false,
							text: `${data[0]}`,
							attachments: []
						}
						for (var i = 1; i < data.length; i++) {
							msg.attachments.push(data[i])
						}
						return msg
					}).then((msg) => {
						robot.messageRoom(userid, msg)
					})
				}
			})
			.catch(error => {
				robot.logger.error(error)
				robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
			})
	}

	function displayRepoSumup(userid, repo, state = '') {

	}

	// TODO: 
	//   check the state when is not provided.
	//	 better msg + title
	//	 same for the functions bellow
	function getPullRequestsSumup(userid, repo, state = '') {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=${state}`,
			method: 'GET',
			headers: getUserHeaders(cred.token),
			json: true
		}
		return new Promise((resolve, reject) => {
			request(options)
				.then(pullRequests => {
					var attachment = slackMsgs.attachment()
					var quantityText, s = 's'
					if (pullRequests.length > 1) {
						quantityText = 'There are ' + pullRequests.length
					}
					else if (pullRequests.length == 1) {
						quantityText = 'There is 1'
						s = ''
					}
					else {
						quantityText = 'There are no'
					}
					if (state == '' || state == 'all') {
						state = 'open/closed'
					}
					attachment.text = `${quantityText} (${state}) ${bold('pull request' + s)}.`
					attachment.color = color.rgbToHex(parseInt(pullRequests.length) * 25, 0, 0)
					resolve(attachment)
				})
				.catch(error => {
					reject(error)
				})
		})
	}

	// TODOs: as mentioned in displayPullRequestsSumup
	function getIssuesSumup(userid, repo, state = '', since = '') {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		if (since) {
			since = `&since=${since}`
		} else {
			since = ''
		}
		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues?state=${state}${since}`,
			method: 'GET',
			headers: getAppHeaders(appToken),
			json: true
		}
		return new Promise((resolve, reject) => {
			request(options)
				.then(issues => {
					var attachment = slackMsgs.attachment()
					var s = ''
					if (issues.length > 1) {
						s = 's'
					}
					attachment.text = `${issues.length} ${bold('issue' + s)} (including PRs) created or updated.`
					attachment.color = color.rgbToHex(parseInt(issues.length) * 25, 0, 0)
					resolve(attachment)
				})
				.catch(error => {
					reject(error)
					// robot.logger.error(error)
					// robot.messageRoom(userid, c.errorMessage)
				})
		})

	}

	// TODOs: as mentioned in displayPullRequestsSumup
	function getCommitsSumup(userid, repo, since = '') {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		if (since) {
			since = `?since=${since}`
		} else {
			since = ''
		}
		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/commits${since}`,
			method: 'GET',
			headers: getAppHeaders(appToken),
			json: true
		}

		return new Promise((resolve, reject) => {
			request(options)
				.then(commits => {
					var attachment = slackMsgs.attachment()
					var s = 's'
					var commitsNum = commits.length
					if (commitsNum == 1) {
						s = ''
					}
					if (commitsNum == 30) { // 30 = the max commits github returns
						commitsNum = '30 or more'
					}
					attachment.text = `${commitsNum} ${bold('commit' + s)} were made.`
					attachment.color = color.rgbToHex(parseInt(commitsNum) * 25, 0, 0)
					resolve(attachment)
				})
				.catch(error => {
					reject(error)
					// robot.logger.error(error)
					// robot.messageRoom(userid, c.errorMessage)
				})
		})
	}

	function listPullRequests(userid, repo, state) {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=${state}`,
			method: 'GET',
			headers: getUserHeaders(cred.token),
			json: true
		}

		request(options)
			.then(pullRequests => {
				var msg = {}
				msg.unfurl_links = false
				if (pullRequests.length > 0) {
					msg.attachments = []
					msg.text = `Pull Requests of <https://www.github.com/${owner}/${repo}|${owner}/${repo}>:`
				} else {
					msg.text = `There aren't any Pull Requests on <https://www.github.com/${owner}/${repo}|${owner}/${repo}>`
				}
				Promise.each(pullRequests, function (pr) {
					var attachment = slackMsgs.attachment()
					var title = pr.title
					var url = pr.html_url
					var num = pr.number
					attachment.text = `<${url}|#${num} ${title}>`


					attachment.author_name = pr.user.login
					attachment.author_link = pr.user.html_url
					attachment.author_icon = pr.user.avatar_url

					if (pr.state.includes('open')) {
						attachment.color = 'good'
					} else {
						attachment.color = 'danger'
					}
					msg.attachments.push(attachment)
				}).done(() => {
					robot.messageRoom(userid, msg)
				})
			})
			.catch(error => {
				robot.messageRoom(userid, c.errorMessage)
			})
	}

	function listRepos(userid) {

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		/* (Possible feature) having more than one Github App installations  */
		var installations = cache.get('GithubApp').length
		for (var i = 0; i < installations; i++) {
			var ghApp = cache.get('GithubApp')
			var installation_id = ghApp[i].id

			var options = {
				url: `${GITHUB_API}/user/installations/${installation_id}/repositories`,
				headers: getUserHeaders(cred.token),
				json: true,
			};

			request(options)
				.then(res => {
					var msg = slackMsgs.basicMessage();
					res.repositories.forEach(function (repo) {
						// TODO: add link to repo 
						msg.attachments[0].text += (`${repo.full_name}\n`)
					})
					return { msg: msg }
				})
				.then((data) => {
					data.msg.text = `Your accessible Repositories: `
					robot.messageRoom(userid, data.msg)
				})
				.catch(err => {
					//TODO handle error codes: i.e. 404 not found -> dont post
					console.log(err)
				})
		}
	}

	function getAccesibleReposName(userid) {

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var ghApp = cache.get('GithubApp')
		var installation_id = ghApp[0].id

		var options = {
			url: `${GITHUB_API}/user/installations/${installation_id}/repositories`,
			headers: getUserHeaders(cred.token),
			json: true,
		};
		return new Promise(function (resolve, reject) {
			request(options)
				.then(res => {
					var reposArray = []
					Promise.each(res.repositories, function (repo) {
						reposArray.push(repo.name)
					}).then(() => {
						resolve(reposArray)
					})
				})
				.catch(error => {
					reject(error)
				})
		})
	}

	function listRepoCommits(userid, repo, commitsCnt, since) {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var parameters = ''
		if (since) {
			parameters = `?since=${since}`
		}

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/commits${parameters}`,
			method: 'GET',
			headers: getAppHeaders(appToken),
			json: true
		}

		request(options)
			.then(repoCommits => {
				var msg = { attachments: [] }
				var attachment = slackMsgs.attachment()
				msg.unfurl_links = false

				if (repoCommits.length > 0) {
					msg.attachments = []
					msg.text = `Commits of <${githubURL}${owner}/${repo}|${owner}/${repo}>:`
				} else {
					msg.text = `<${githubURL}${owner}/${repo}|{${owner}/${repo}]>: No Commits found`
				}
				if (commitsCnt) {
					repoCommits = repoCommits.slice(0, commitsCnt)
				}
				Promise.each(repoCommits, function (commit) {
					var authorUsername = commit.author.login;
					var authorURL = githubURL + authorUsername;
					var commitID = commit.sha.substr(0, 7);		 	// get the first 7 chars of the commit id
					var commitMsg = commit.commit.message.split('\n', 1); 	// get only the commit msg, not the description
					var commitURL = commit.html_url;
					commitID = "`" + commitID + "`"
					attachment.text += `\n<${commitURL}|${commitID}> ${commitMsg} - ${authorUsername}`;
				}).then(() => {
					msg.attachments.push(attachment)
				}).done(() => {
					robot.messageRoom(userid, msg)
				})
			})
			.catch(err => { console.log(err) })
	}

	function listRepoIssues(userid, repo, paramsObj = { state: 'open' }, issuesCnt) {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var params = querystring.stringify(paramsObj)
		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues?${params}`,
			method: 'GET',
			headers: getAppHeaders(appToken),
			json: true
		}

		request(options)
			.then(repoIssues => {
				var msg = {}
				msg.unfurl_links = false
				if (repoIssues.length > 0) {
					msg.attachments = []
					if (paramsObj.mentioned) {
						var issueStatus = 'Your mentioned'
					}
					else {
						issueStatus = paramsObj.state.capitalize()
					}
					msg.text = `${issueStatus} issues of <https://www.github.com/${owner}/${repo}|${owner}/${repo}>:`
				}
				else {
					msg.text = `There aren't any issues on <https://www.github.com/${owner}/${repo}|${owner}/${repo}>`
				}
				if (issuesCnt) {
					repoIssues = repoIssues.slice(0, issuesCnt)
				}
				Promise.each(repoIssues, function (issue) {
					var attachment = slackMsgs.attachment()
					var title = issue.title
					var url = issue.html_url
					var num = `#${issue.number}`
					var userLogin = issue.user.login
					var userAvatar = issue.user.avatar_url
					var userUrl = issue.user.html_url

					attachment.author_name = userLogin
					attachment.author_icon = userAvatar
					attachment.author_link = userUrl
					attachment.text = ` <${url}|${num}: ${title}>`

					if (issue.body) {
						attachment.fields.push({
							title: '',
							value: issue.body,
							short: false
						})
					}

					/* Do i have to provide the state of issue when i use green and red color instead? */
					// attachment.fields.push({
					// 	title: 'State',
					// 	value: issue.state,
					// 	short: true
					// })

					if (issue.state.includes('open')) {
						attachment.color = 'good'
					} else {
						attachment.color = 'danger'
					}
					msg.attachments.push(attachment)
				}).done(() => {
					robot.messageRoom(userid, msg)
				})
			})
			.catch(err => { console.log(err) })
	}

	function listIssueComments(userid, issueNum, repo = null) {
		var ghApp = cache.get('GithubApp')
		var appToken = ghApp[0].token
		var owner = ghApp[0].account

		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNum}/comments`,
			method: 'GET',
			headers: getUserHeaders(cred.token),
			json: true
		}

		request(options)
			.then(issueComments => {
				var msg = {}
				msg.unfurl_links = false
				var repo_url = `${githubURL}${owner}/${repo}`

				if (issueComments.length > 0) {
					msg.attachments = []
					msg.text = `<${repo_url}|[${owner}/${repo}]> <${repo_url}/issues/${issueNum}|Issue #${issueNum}>:`
				} else {
					msg.text = `<${repo_url}/issues/${issueNum}|Issue #${issueNum}> of repository ${repo} hasn't any comments yet.`
				}
				Promise.each(issueComments, function (comment) {
					var attachment = slackMsgs.attachment()
					var body = comment.body
					// tODO: should i use created_at instead of updated_at 	?
					var ts = Date.parse(comment.updated_at) / 1000//dateFormat(new Date(comment.created_at), 'mmm dS yyyy, HH:MM'
					var url = comment.html_url
					var userLogin = comment.user.login
					var userUrl = comment.user.html_url
					var userAvatar = comment.user.avatar_url

					attachment.author_name = userLogin
					attachment.author_icon = userAvatar
					attachment.author_link = userUrl
					attachment.ts = ts
					attachment.color = 'warning'
					// attachment.pretext = `*${user}* commented on <${url}|${created_at}>`
					attachment.text = body

					msg.attachments.push(attachment)
				}).done(() => {
					robot.messageRoom(userid, msg)
				})

			})
			.catch(err => {
				//TODO handle error codes: i.e. 404 not found -> dont post
				console.log(err)
			})
	}

	function createIssue(userid, repo, title, body, label = [], assignees = []) {
		var cred = getCredentials(userid)
		if (!cred) { return 0 }

		var ghApp = cache.get('GithubApp')
		var owner = ghApp[0].account

		var dataObj = {
			title: title,
			body: body,
			labels: label,
			assignees: assignees
		}

		var options = {
			url: `${GITHUB_API}/repos/${owner}/${repo}/issues`,
			method: 'POST',
			body: dataObj,
			headers: getUserHeaders(cred.token),
			json: true
		}

		request(options)
			.then(res => {
				// TODO: maybe format the massage and give a url for the issue
				robot.messageRoom(userid, `issue created. `)
				// console.log(res)
			})
			.catch(err => {
				//TODO handle error codes: i.e. 404 not found -> dont post
				console.log(err)
			})
	}


	/*************************************************************************/
	/*                          helpful functions                            */
	/*************************************************************************/


	function getCredentials(userid) {

		try {
			var token = cache.get(userid).github_token
			var username = cache.get(userid).github_username

			if (!token || !username) { // catch the case where username or token are null/undefined
				throw `User credentials not found. userid: ${userid}`
			}
		} catch (error) {
			oauthLogin(userid)
			return false
		}
		return {
			username: username,
			token: token
		}
	}

	function getUserHeaders(token) {
		return {
			'Authorization': `token ${token}`,
			'Accept': 'application/vnd.github.machine-man-preview+json',
			'User-Agent': 'Hubot For Github'
		}
	}

	function getAppHeaders(token) {
		return {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/vnd.github.machine-man-preview+json',
			'User-Agent': 'Hubot For Github'
		}
	}
	function oauthLogin(userid) {
		// TODO change message text 
		robot.messageRoom(userid, `Click <${bot_host_url}/auth/github?userid=${userid}|here> to authenticate your github account.`);
	}

	function getAppToken(appID) {
		var db = mongoskin.MongoClient.connect(mongodb_uri)
		db.bind('GithubApp')
		return db.GithubApp.findOneAsync({ _id: appID })
			.then(dbData => encryption.decrypt(dbData.token))
			.catch(error => {
				robot.logger.error(error)
				if (c.errorsChannel) {
					robot.messageRoom(c.errorsChannel, c.errorMessage
						+ `Script: ${path.basename(__filename)}`)
				}
			})
	}

	function errorHandler(userid, error) {
		// TODO change the messages
		if (error.statusCode == 401) {
			robot.messageRoom(userid, c.jenkins.badCredentialsMsg)
		} else if (error.statusCode == 404) {
			robot.messageRoom(userid, c.jenkins.jobNotFoundMsg)
		} else {
			robot.messageRoom(userid, c.errorMessage + 'Status Code: ' + error.statusCode)
			robot.logger.error(error)
		}
	}

	function updateConversationContent(userid, content) {
		cache.set(userid, { content: content })
	}

	function getConversationContent(userid, key) {
		try {
			var content = cache.get(userid, 'content')[key]
			if (!content) {
				throw 'content ' + key + ' for userid ' + userid + ' not found.'
			} else {
				return content
			}
		} catch (error) {
			return false
		}
	}

	function getSlackUser(username) {

		var userids = cache.get('userIDs')

		for (var i = 0; i < userids.length; i++) {
			var id = userids[i]

			var user = cache.get(id)
			var githubUsername
			try {
				var githubUsername = user.github_username
				if (githubUsername == username) {
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
}
