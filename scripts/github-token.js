var encryption = require('./encryption.js');
var GitHubApi = require('github')
var mongoskin = require('mongoskin');
var cache = require('./cache.js').getCache()
var oauth = require("oauth").OAuth2;

var bot_host = process.env.HUBOT_HOST_URL
var mongodb_uri = process.env.MONGODB_URI
var client_id = process.env.GITHUB_APP_CLIENT_ID;
var client_secret = process.env.GITHUB_APP_CLIENT_SECRET;
var hostUrl = 'http://github.com/login/oauth/authorize';
var authorization_base_url = 'https://github.com/login/oauth/authorize'
var token_url = 'https://github.com/login/oauth/access_token'



var OAuth2 = new oauth(
    client_id,
    client_secret,
    "https://github.com/",
    "login/oauth/authorize",
    "login/oauth/access_token");

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
        var username = JSON.parse(req.query.state).username;

        var code = req.query.code;

        OAuth2.getOAuthAccessToken(code, {}, function (err, access_token) {
            if (err) {
                console.log(err);
            }

            // ****
            // TODO:
            // BETTER Handling of promises!!
            // ****

            var db = mongoskin.MongoClient.connect(mongodb_uri);

            github.authenticate({
                "type": "token",
                "token": access_token
            })
            github.users.get({}, function (err, res) {
                var github_username = res.data.login
                db.bind('users').findAndModifyAsync(
                    { _id: userid },
                    [["_id", 1]],
                    { $set: { github_username: github_username } },
                    { upsert: true })
                    .then(res => { })
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
                        robot.logger.info(`${username}'s GitHub Token Added to DB!`)
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
            });
        });
        res.redirect('');
    });

}