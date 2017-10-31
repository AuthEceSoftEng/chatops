var encryption = require('./encryption.js');
var cache = require('./cache.js').getCache()
var oauth = require("oauth").OAuth2;

var client_id = process.env.GITHUB_APP_CLIENT_ID;
var client_secret = process.env.GITHUB_APP_CLIENT_SECRET;
var bot_host = process.env.HUBOT_HOST_URL
var hostUrl = 'http://github.com/login/oauth/authorize';
var authorization_base_url = 'https://github.com/login/oauth/authorize'
var token_url = 'https://github.com/login/oauth/access_token'

if (!client_id || !client_secret || !bot_host) {
    return
}

module.exports = function (robot) {

    var OAuth2 = new oauth(
        client_id,
        client_secret,
        "https://github.com/",
        "login/oauth/authorize",
        "login/oauth/access_token");

    robot.router.get('/auth/github', function (req, res) {
        // get the user id and pass it through 'state' for later use
        var state = JSON.stringify({
            userid: req.query.userid,
            username: req.query.username
        });
        res.writeHead(303, {
            Location: OAuth2.getAuthorizeUrl({
                redirect_uri: `${bot_host}/auth/github/callback`,
                scope: "read:org,user,public_repo,repo,repo_deployment,delete_repo,notifications,gist,read,write,admin",
                state: state
            }),
            'Accept': 'application/vnd.github.machine-man-preview+json'
        });
        res.end();
    });
}