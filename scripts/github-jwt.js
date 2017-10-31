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
var appID = process.env.GITHUB_APP_ID
var mongodb_uri = process.env.MONGODB_URL
var privateKeyDir = process.env.GITHUB_PEM_DIR
var privateKeyText = process.env.GITHUB_PEM

if (!appID || !mongodb_uri || (!privateKeyDir && !privateKeyText)) {
    console.log('warning', 'script: ' + path.basename(__filename) + ' is disabled due to missing env vars')
    return
}
    
module.exports = robot => {

    // runs once the bot starts 
    generateJWToken()

    // runs on demand from other scritps
    robot.on('generateJWToken', () => {
        generateJWToken()
    })

    // generate a new token every 30 minutes. (Tokens expire after 60 minutes)
    var job = new CronJob('0 */30 * * * *',
        function () {
            generateJWToken()
        },
        function () { return null; }, /* This function is executed when the job stops */
        true, /* Start the job right now */
        'Europe/Athens' /* Time zone of this job. */
    );


    function generateJWToken() {
        if (privateKeyText) {
            var cert = privateKeyText.replace(/\\n/g, '')
        } else {
            var cert = fs.readFileSync(privateKeyDir, 'utf8')  // the get private key
        }

        var date = new Date()
        var payload = {
            iat: Math.round(new Date().getTime() / 1000),
            exp: Math.round(new Date().getTime() / 1000) + (10 * 60),
            iss: appID
        }
        var JWToken = jwt.sign(payload, cert, { algorithm: 'RS256' })
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
            .catch(error => {   
                robot.logger.error('JWT error: ' + error)
            })
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
                robot.logger.info('Github App installation token created.')
            })
            .catch(function (err) {
                console.log('ERROR: ', err)
            })
    }
}