var mongoskin = require('mongoskin')
var Promise = require('bluebird')
var encryption = require('./encryption.js')
var c = require('./config.json')
var path = require('path')
var cache = require('./cache.js').getCache()
Promise.promisifyAll(mongoskin)

// config
var mongodb_uri = process.env.MONGODB_URL || process.env.MONGOLAB_URI
if (!process.env.MONGODB_URL) {
    return
}

module.exports = (robot) => {

    adapterUsersIDsToCache()
    usersDataToCache()
    trelloWebhooksInfoToCache()
    channelsTrelloBoardsToCache()
    robot.brain.constructor(robot)

    robot.on('refreshBrain', function () {
        // not sure yet if it's needed
        // adapterUsersIDsToCache()

        usersDataToCache()
    })

    robot.on('resetCacheForTrelloWebhooks', function () {
        cache.del('trelloWebhooks')
        trelloWebhooksInfoToCache()
    })

    function usersDataToCache() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.collection('users').find().toArrayAsync()
            .then(data => {
                data.forEach(function (document) {
                    var github_token = document.github_token
                    var jenkins_token = document.jenkins_token          // jenkins token and ...
                    var jenkins_username = document.jenkins_username    // ... username are indepented additions
                    var jenkins_crumb = document.jenkins_crumb
                    var trello_token = document.trello_token
                    var trello_last_notification = document.trello_last_notification
                    var trello_member_id = document.trello_member_id
                    var github_last_sumup_date = document.github_last_sumup_date
                    var id = document._id // represents the userid in chat adapter

                    if (github_token) {
                        var values = {
                            github_username: document.github_username,
                            github_token: encryption.decryptSync(github_token)
                        }
                        cache.set(id, values)
                    }

                    if (jenkins_token) {
                        cache.set(id, { jenkins_token: encryption.decryptSync(jenkins_token) })
                    }

                    if (jenkins_username) {
                        cache.set(id, { jenkins_username: jenkins_username })
                    }

                    if (jenkins_crumb) {
                        cache.set(id, { jenkins_crumb: jenkins_crumb })
                    }

                    if (trello_token) {
                        var values = {
                            trello_username: document.trello_username,
                            trello_token: encryption.decryptSync(trello_token),
                            trello_member_id: trello_member_id
                        }
                        cache.set(id, values)
                    }

                    if (trello_last_notification) {
                        cache.set(id, { trello_last_notification: trello_last_notification })
                    }

                    if (github_last_sumup_date) {
                        cache.set(id, { github_last_sumup_date: github_last_sumup_date })
                    }
                })
            }).catch(dbError => {
                robot.logger.error(dbError)
                if (c.errorsChannel)
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
            }).done(() => {
                db.close()
            })
    }

    function trelloWebhooksInfoToCache() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)

        db.collection('trelloWebhooks').find().toArrayAsync()
            .then(data => {
                data.forEach(function (webhook) {

                    webhookObj = {
                        webhook_id: webhook._id,
                        userid: webhook.userid,
                        model_id: webhook.idModel,
                        room: webhook.room
                    }
                    cache.union('trelloWebhooks', webhookObj)
                })
            }).catch(dbError => {
                robot.logger.error(dbError)
                if (c.errorsChannel)
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
            }).done(() => {
                db.close()
            })
    }

    function channelsTrelloBoardsToCache() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)

        db.collection('channelsToTrelloBoards').find().toArrayAsync()
            .then(data => {
                data.forEach(function (channel) {
                    cache.set(`channelsToBoards.${channel._id}`, channel.board)
                })
            }).catch(dbError => {
                robot.logger.error(dbError)
                if (c.errorsChannel)
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
            }).done(() => {
                db.close()
            })
    }

    function adapterUsersIDsToCache() {
        var usersObject = robot.brain.users()
        var usersIDs = Object.keys(usersObject)
        var adapter = robot.adapterName
        for (var i = 0; i < usersIDs.length; i++) {
            var user = usersObject[usersIDs[i]][adapter]
            try {
                if (!user.is_bot && !user.is_app_user) {
                    cache.union('userIDs', user.id)
                }
            } catch (error) {
                // do nothing
            }
        }
    }




    // ***********************************************
    // TO BE DELETED
    // FOR DEBUGGING
    robot.respond(/show cache/, function (res) {
        console.log(cache.data)
    })


    // ***********************************************


}


