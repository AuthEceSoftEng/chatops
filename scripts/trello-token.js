// Commands: 
// `trello login`

var slackMsgs = require('./slackMsgs.js');
var url = require('url');
var Promise = require('bluebird');
var request = require('request-promise');
var encryption = require('./encryption.js');
var mongo = require('mongoskin');
var cache = require('./cache.js').getCache()
Promise.promisifyAll(mongo);

// config
var uri = process.env.MONGODB_URL;
var trelloKey = process.env.HUBOT_TRELLO_KEY;
var trello_url = 'https://api.trello.com'
var app_key = process.env.HUBOT_TRELLO_KEY;
var oauth_secret = process.env.HUBOT_TRELLO_OAUTH;
var host_url = process.env.HUBOT_HOST_URL

if (!uri || !trelloKey || !app_key || !oauth_secret || !host_url) {
    return
}

module.exports = function (robot) {

    var oauth_secrets = {};
    var loginCallback = `${host_url}/hubot/trello-token`;
    var scope = 'read,write,account'
    var expr = 'never' // expiration
    var TrelloOAuth = require('./trello-oauth.js')
    var tOAuth = new TrelloOAuth(app_key, oauth_secret, loginCallback, 'Hubot', scope, expr);

    // TODO: move this listener to trello-integration and emit a trelloOAuthLogin event. 
    robot.respond(/trello login/, function (res) {
        trelloOAuthLogin(res.message.user.id)
    })

    robot.on('trelloOAuthLogin', function (userid) {
        trelloOAuthLogin(userid)
    })

    function trelloOAuthLogin(userid) {
        tOAuth.getRequestToken(function (err, data) {
            oauth_secrets['id'] = userid
            oauth_secrets[data.oauth_token] = data.oauth_token_secret;

            var loginMsg = `Click <${data.redirect}|here> to authenticate your Trello account`
            robot.messageRoom(userid, loginMsg);
        })
    }

    robot.router.get('/hubot/trello-token', function (req, res_r) {
        var db = mongo.MongoClient.connect(uri);

        let args = req.query;
        let query = url.parse(req.url, true).query;
        let token = query.oauth_token;
        args['oauth_token_secret'] = oauth_secrets[token];
        tOAuth.getAccessToken(args, function (err, data) {
            if (err) throw err;
            let userName = oauth_secrets['username'];
            let userId = oauth_secrets['id'];

            var options = {
                method: 'GET',
                url: `${trello_url}/1/members/me?key=${trelloKey}&token=${data['oauth_access_token']}`,
                json: true
            }
            request(options).then(res => {
                var values = {
                    trello_member_id: res.id,
                    trello_username: res.username,
                    trello_token: data['oauth_access_token']
                }
                cache.set(userId, values)

                encryption.encrypt(data['oauth_access_token'])
                    .then(token => {
                        db.bind('users');
                        db.users.findAndModifyAsync(
                            { _id: userId },
                            [["_id", 1]],
                            { $set: { trello_token: token, trello_username: res.username, trello_member_id: res.id } },
                            { upsert: true })
                            .then(res => {
                            }).catch(err => { //TODO better error handling
                                console.log(err)
                            }).done(() => {
                                db.close();
                            })
                    });
            }).catch(err => {
                console.log(err)
            })
            //TODO error

        })
        res_r.redirect('/token%20received');
    });

}