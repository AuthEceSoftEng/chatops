var apiai = require('apiai')
var util = require('util')
var path = require('path')
var cache = require('./cache.js').getCache()

var apiai_token = process.env.APIAI_TOKEN
var errorChannel = process.env.HUBOT_ERRORS_CHANNEL
var SCORE_THRESHOLD = 0.75

var app = apiai(apiai_token)

module.exports = robot => {

    // ask api.ai directly
    robot.respond(/ai (.*)/i, res => {
        var msg = res.match[1]
        apiaiAsk(msg, res)
    })

    robot.catchAll(function (res) {
        // var regexp = new RegExp("^(?:" + robot.alias + "|" + robot.name + ") (.*)", "i") 
        var regex = new RegExp(robot.name + " (.*)", "i")
        if (res.message.text.match(regex)) { // captures only direct messages and not messages in channels 
            var msg = res.message.text.match(regex)[1]
            apiaiAsk(msg, res)
            console.log('api.ai', msg)
        }
    })


    // sending a msg to api.ai from other scripts
    robot.on('ask-api.ai', function (msg, res) {
        apiaiAsk(msg, res)
    })

    // trigger an event to api.ai from other scripts
    robot.on('event-api.ai', function (eventName, userId) {
        // console.log(eventName, userId)
        apiaiEvent(eventName)
    })


    var activeAction = {}

    function apiaiAsk(msg, res) {
        var userId = res.message.user.id

        var options = {
            sessionId: userId
        }

        var request = app.textRequest(msg, options)

        request.on('response', function (response) {
            if (response.result.score < SCORE_THRESHOLD) {
                activeAction[response.sessionId] = response.result.action
                var intentName = response.result.metadata.intentName
                res.reply(`Do you mean ${intentName} ?`)
                apiaiEvent('notSure', res)
                return
            }
            else {
                responseCallback(response, res)
            }
        })

        request.on('error', function (error) {
            robot.messageRoom(errorChannel, `Error in ${path.basename(__filename)} script. Please check the Server Log for more details.`)
            robot.logger.error(error)
        })

        request.end()
    }


    function apiaiEvent(eventName, res, data = {}) {
        var userId = res.message.user.id

        var event = {
            name: eventName,
        }

        var options = {
            sessionId: userId
        }

        var request = app.eventRequest(event, options)

        request.on('response', function (response) {
            responseCallback(response, res)
        })

        request.on('error', function (error) {
            robot.messageRoom(errorChannel, `Error in ${path.basename(__filename)} script. Please check the Server Log for more details.`)
            robot.logger.error(error)
        })

        request.end()
    }

    function notSure(action, res) {
        res.reply('Do you mean ' + action + '?')
        apiaiEvent('notSure', res, { action: action })
    }

    function responseCallback(response, res) {
        var result = response.result
        var userId = res.message.user.id
        var roomid = res.message.room

        // console.log(response)
        if (result.score < SCORE_THRESHOLD) {
            apiaiEvent('uknownInput', userId)
            return 0
        }

        // if the action is completed, emit the data 
        var isComplete = !result.actionIncomplete
        if (isComplete) {
            var handled = robot.emit(result.action, result, res)
            if (!handled) {
                robot.logger.info('No scripts handled the api.ai action: ' + result.action)
            }
        }

        // reply back to user
        if (result.fulfillment.speech) {
            robot.messageRoom(roomid, result.fulfillment.speech)
        }
    }

    robot.on('notSure.yes', function (result, res) {
        var userid = res.message.user.id
        apiaiEvent(activeAction[userid], res)
    })

}