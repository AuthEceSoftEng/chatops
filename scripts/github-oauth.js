module.exports = function (robot) {
    var encryption = require('./encryption.js');

    var client_id = process.env.GITHUB_APP_CLIENT_ID;
    var client_secret = process.env.GITHUB_APP_CLIENT_SECRET;
    var hostUrl = 'http://github.com/login/oauth/authorize';
    var authorization_base_url = 'https://github.com/login/oauth/authorize'
    var token_url = 'https://github.com/login/oauth/access_token'
    var bot_host = process.env.HUBOT_HOST_URL
    var GitHubApi = require('github')
    var cache = require('./cache.js').getCache()
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

    var oauth = require("oauth").OAuth2;
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