var encryption = require('./encryption.js');
var GitHubApi = require('github')
var mongoskin = require('mongoskin');
var cache = require('./cache.js').getCache()
var oauth = require("oauth").OAuth2;
var c = require('./config.json')
var path = require('path')

var bot_host = process.env.HUBOT_HOST_URL
var mongodb_uri = process.env.MONGODB_URL
var client_id = process.env.GITHUB_APP_CLIENT_ID;
var client_secret = process.env.GITHUB_APP_CLIENT_SECRET;
var hostUrl = 'http://github.com/login/oauth/authorize';
var authorization_base_url = 'https://github.com/login/oauth/authorize'
var token_url = 'https://github.com/login/oauth/access_token'

if (!bot_host || !mongodb_uri || !client_id || !client_secret) {
    console.log('warning','script: '+path.basename(__filename)+' is disabled due to missing env vars')
    return
}

var OAuth2 = new oauth(
    client_id,
    client_secret,
    "https://github.com/",
    "login/oauth/authorize",
    "login/oauth/access_token");

// TODO: remove github dependency and convert it to the classic 'request' method. (like github-integration.js)
var github = new GitHubApi({
    /* optional */
    // debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    thPrefix: "/api/v3", // for some GHEs; none for GitHub
    headers: {
        "Accept": "application/vnd.github.machine-man-preview+json",
        "user-agent": "Hubot-GitHub" // GitHub is happy with a unique user agent
    },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
})

module.exports = (robot) => {

    robot.router.get('/auth/github/callback', function (req, res) {
        var userid = JSON.parse(req.query.state).userid;

        var code = req.query.code;

        OAuth2.getOAuthAccessToken(code, {}, function (err, access_token) {
            if (err) {
                console.log(err);
            }
            var db = mongoskin.MongoClient.connect(mongodb_uri);

            github.authenticate({
                "type": "token",
                "token": access_token
            })
            github.users.get({}, function (err, gh_res) {
                var github_username = gh_res.data.login
                db.bind('users').findAndModifyAsync(
                    { _id: userid },
                    [["_id", 1]],
                    { $set: { github_username: github_username } },
                    { upsert: true })
                    .then(gh_res => { })
                    .catch(err => {
                        robot.logger.error(err)
                        if (c.errorsChannel) {
                            robot.messageRoom(c.errorsChannel, c.errorMessage
                                + `Script: ${path.basename(__filename)}`)
                        }
                    })
                var values = {
                    github_username: github_username,
                    github_token: access_token
                }
                cache.set(userid, values)
            })
            encryption.encrypt(access_token).then(encryptedToken => {

                //TODO -> convert to promise
                db.bind('users').findAndModifyAsync(
                    { _id: userid },
                    [["_id", 1]],
                    { $set: { github_token: encryptedToken } },
                    { upsert: true })
                    .then(res => {
                        var username = robot.brain.userForId(userid).name
                        robot.logger.info(`${username}'s GitHub Token Added to DB.`)
                        robot.emit('refreshBrain') //refresh brain to update tokens       
                    })
                    .catch(err => {
                        robot.logger.error(err)
                        if (c.errorsChannel) {
                            robot.messageRoom(c.errorsChannel, c.errorMessage
                                + `Script: ${path.basename(__filename)}`)
                        }
                    })
                    .done(() => {
                        db.close()
                    })
            })
        })
        res.redirect('/token%20received');
    });

}