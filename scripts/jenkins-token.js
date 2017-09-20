// Commands:
//   `jenkins login`
//   `jenkins token <token>`
//   `jenkins username <username>`


'use strict'

// init
var mongoskin = require('mongoskin');
var encryption = require('./encryption.js');
var cache = require('./cache.js').getCache()
var request = require('request-promise')

// config
var mongodb_uri = process.env.MONGODB_URI
var jenkins_url = process.env.JENKINS_URL

module.exports = robot => {


    var r = new RegExp("^(?=.*\bjenkins\b)(?=.*\blogin).*$", "i")
    robot.respond(/(?=.*\bjenkins\b)(?=.*\blogin).*$/i, function (res) {
        jenkinsLoginDisplayMsg(res)
    })

    robot.on('jenkinsLogin', function (userid) {
        jenkinsLoginDisplayMsg(userid)
    })

    robot.respond(/jenkins token (.*)/i, function (res) {
        var token = res.match[1]
        storeJenkinsToken(token, res);
    })
    robot.on('jenkinsAddToken',function(data,res){
        var token = data.parameters.token
        storeJenkinsToken(token, res)
    })

    robot.respond(/jenkins username (.*)/i, function (res) {
        var username = res.match[1]
        storeJenkinsUsername(username, res);
    })

    function jenkinsLoginDisplayMsg(res) {
        try {
            var userId = res.message.user.id
        } catch (error) {
            var userId = res // in case of calling the function providing userid only
        }

        var url = process.env.JENKINS_URL + '/me/configure'
        var msg = `Please <${url}|login> to your Jenkins account and provide me your API Token (or password) and username here`
        msg += ' by telling me something like\n`jenkins token <YOUR_TOKEN>` and `jenkins username <YOUR_USERNAME>` respectively.'
        msg += `\nAfter that, i will encrypt them and store them somewhere safe for later use :slightly_smiling_face:`
        robot.messageRoom(userId, msg)
    }

    function storeJenkinsToken(token, res) {
        var userId = res.message.user.id;

        var values = {
            jenkins_token: token
        }
        cache.set(userId, values)
        encryption.encrypt(token)
            .then(encryptedToken => {
                //TODO find jenkins username and store it
                var c = require('./config.json');

                var db = mongoskin.MongoClient.connect(mongodb_uri);
                db.bind('users');
                db.users.findAndModifyAsync(
                    { _id: userId },
                    [["_id", 1]],
                    { $set: { jenkins_token: encryptedToken } },
                    { upsert: true })
                    .then(res => {
                        robot.messageRoom(userId, c.tokenAddedMessage)
                    })
                    .catch(err => {//TODO better error handling
                        robot.messageRoom(userId, c.errorMessage)
                        robot.logger.error(err);
                    })
                    .done(() => {
                        db.close();
                        generateJenkinsCrumb(userId)
                    })

            })
            .catch(encryptionError => {
                //TODO
            })

    }

    function storeJenkinsUsername(username, res) {
        var userId = res.message.user.id;

        var values = {
            jenkins_username: username
        }
        cache.set(userId, values)

        //TODO find jenkins username and store it
        var c = require('./config.json');

        var db = mongoskin.MongoClient.connect(mongodb_uri);
        db.bind('users');
        db.users.findAndModifyAsync(
            { _id: userId },
            [["_id", 1]],
            { $set: values },
            { upsert: true })
            .then(res => {
                robot.messageRoom(userId, 'jenkins username succesfully received!')
            })
            .catch(err => {//TODO better error handling
                robot.messageRoom(userId, c.errorMessage)
                robot.logger.error(err);
            })
            .done(() => {
                db.close();
                generateJenkinsCrumb(userId)
            })
    }

    function generateJenkinsCrumb(userId) {
        try {
            var token = cache.get(userId).jenkins_token
            var username = cache.get(userId).jenkins_username
            if (!token || !username) { // catch the case where username or token are null/undefined
                throw error
            }
            var options = {
                url: `${jenkins_url}/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,":",//crumb)`,
                auth: {
                    'user': username,
                    'pass': token
                },
                json: true
            };


            request(options)
                .then(data => {
                    return data.split(':')[1]
                })
                .then(crumb => {
                    cache.set(userId, { jenkins_crumb: crumb })
                    return { jenkins_crumb: crumb }
                })
                .then(values => {
                    var db = mongoskin.MongoClient.connect(mongodb_uri);
                    db.bind('users').findAndModifyAsync(
                        { _id: userId },
                        [["_id", 1]],
                        { $set: values },
                        { upsert: true })
                })
                .catch(error => {
                    if (error.statusCode == 401) {
                        var msg = 'Hey, it seems that your Jenkins credentials are wrong!'
                            + '\nSay `jenkins login` to login again.'
                        robot.messageRoom(userId, msg)
                    }
                })


        } catch (error) {
            // Do nothing
            // TODO: make sure i should not do something else here
        }
    }

}