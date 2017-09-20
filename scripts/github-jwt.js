'use strict'

var jwt = require('jsonwebtoken')
var fs = require('fs')
var c = require('./config.json')
var path = require('path')
var request = require('request-promise')
var CronJob = require('cron').CronJob
var Promise = require('bluebird')
var mongoskin = require('mongoskin')
var cache = require('./cache.js').getCache()
Promise.promisifyAll(mongoskin)

// config
var appID = (process.env.GITHUB_APP_ID || c.GithubApp.AppId)
var mongodb_uri = process.env.MONGODB_URI
var db = mongoskin.MongoClient.connect(mongodb_uri)

module.exports = robot => {

    // runs once the bot starts 
    generateJWToken()

    // runs on demand
    robot.on('generateJWToken', () => {
        robot.logger.info('emit: generateJWToken')
        generateJWToken()
    })

    // generate a new token every 30 minutes. (Tokens expire after 60 minutes)
    var job = new CronJob('0 */30 * * * *',
        function () {
            robot.logger.info('cronjob for generateJWToken')
            generateJWToken()
        },
        function () { return null; }, /* This function is executed when the job stops */
        true, /* Start the job right now */
        'Europe/Athens' /* Time zone of this job. */
    );


    function generateJWToken() {
        // TODO
        var privateKeyDir = (c.GithubApp.privateKeyDir || process.env.GITHUB_KEY_DIR)
        var cert = fs.readFileSync(path.resolve(__dirname, c.GithubApp.privateKeyDir));  // the get private key
        // end of todo

        var date = new Date();
        var payload = {
            iat: Math.round(new Date().getTime() / 1000),
            exp: Math.round(new Date().getTime() / 1000) + (10 * 60),
            iss: appID
        }
        var JWToken = jwt.sign(payload, cert, { algorithm: 'RS256' })
        console.log('\n\nJWT=' + JWToken)
        var options = {
            url: 'https://api.github.com/app/installations',
            headers: {
                Authorization: `Bearer ${JWToken}`,
                'Accept': 'application/vnd.github.machine-man-preview+json',
                'User-Agent': 'myHubot'
            },
            json: true,
            // resolveWithFullResponse: true // Get the full response instead of just the body (DEFAULT: False)
        }

        request(options)
            .then(function (body) {
                var installations = body.length
                for (var i = 0; i < installations; i++) {
                    var installation_id = body[i].id
                    var installation_account = body[i].account.login
                    generateInstallationToken(installation_id, installation_account, JWToken)
                }
            })
            .catch(function (err) {
                console.log(err)
            });
    }

    function generateInstallationToken(installation_id, installation_account, JWToken) {
        var options = {
            method: 'POST',
            url: `https://api.github.com/installations/${installation_id}/access_tokens`,
            headers: {
                Authorization: `Bearer ${JWToken}`,
                'Accept': 'application/vnd.github.machine-man-preview+json',
                'User-Agent': 'Hubot-integration'
            },
            json: true,
        }

        request(options)
            .then(function (res) {
                // store token in cache
                var token = res.token;
                cache.set(`GithubApp`, [{ id: installation_id, account: installation_account, token: token }])
            })
            .catch(function (err) {
                // print eror 
                console.log('ERROR: ', err)
            })
    }
}