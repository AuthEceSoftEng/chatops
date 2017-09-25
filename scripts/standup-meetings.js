// Description:
//   Standups
//
// Commands:
//   `standup report` - triggers a new standup 
//   `standup disable|deactivate|pause` - disable the default standup
//   `standup enable|activate|resume`
//   `standup settings`
//   `standup edit|change channel to <channel name>`
//   `standup edit|change days to <dayName1, dayName2, ...>`
//   `standup edit time to <HH:MM>`
//   `standup add question "<question>" to <order number> with <color name>`
//   `standup remove|delete question <Question Number>`
//   `standup edit|change question <Question Number> color to <color name>`
//   `standup edit|change question <Question Number> text to <color name>`
//   `standup move question <number> to <number>`
//   `standup reset`

'use strict'

const Conversation = require('./hubot-conversation/index.js')
var slackMsg = require('./slackMsgs.js')
var cache = require('./cache.js').getCache()
var c = require('./config.json')
var color = require('./colors.js')
var CronJob = require('cron').CronJob
var path = require("path")
var async = require('async')
var dateFormat = require('dateformat')
var Promise = require('bluebird')
var mongoskin = require('mongoskin')
Promise.promisifyAll(mongoskin)

// config
var mongodb_uri = process.env.MONGODB_URI
var errorChannel = process.env.HUBOT_ERRORS_CHANNEL || null

module.exports = function (robot) {

    // init standups
    async.series([
        function (done) {
            initDefaultStandup()
            done()
        },
        function (done) {
            getAllStandupsData()
        }
    ])

    /*************************************************************************/
    /*                            Listeners                                  */
    /*************************************************************************/

    var switchBoard = new Conversation(robot)


    /** triggers a standup **/
    robot.hear(/standup (start|begin|trigger|report)/i, function (res) {
        var roomid = res.message.user.room
        var userid = res.message.user.id
        if (roomid[0] != 'D') { // if msg is not a direct msg (DM) with a user but in channel. (tested in slack only)
            getStandupData('defaultStandup', roomid)
        } else {
            getStandupData('defaultStandup', res.message.user.id)
        }

    })

    robot.on('triggerStandupReport', function ({ }, res) {
        var userid = res.message.user.id
        var roomid = res.message.user.room
        if (roomid[0] != 'D') { // if msg is not a direct msg (DM) with a user but in channel. (tested in slack only)
            getStandupData('defaultStandup', roomid)
        } else {
            getStandupData('defaultStandup', userid)
        }
    })


    robot.respond(/standup (pause|deactivate|disable)/i, function (res) {
        var userid = res.message.user.id
        updateStandupStatus(userid, 'defaultStandup', false)
    })

    robot.respond(/standup (resume|activate|enable)/i, function (res) {
        var userid = res.message.user.id
        updateStandupStatus(userid, 'defaultStandup', true)
    })

    robot.on('changeStandupStatus', function (data, res) {
        var userid = res.message.user.id
        updateStandupStatus(userid, 'defaultStandup', data.parameters.status)
    })


    robot.respond(/standups? (show |view |get |)settings/i, function (res) {
        var userid = res.message.user.id
        showStandups(userid)
    })

    robot.on('showStandupConfiguration', function ({ }, res) {
        var userid = res.message.user.id
        showStandups(userid)
    })


    robot.respond(/standup (edit|change|modify|update) channel ?t?o? (.*)/i, function (res) {
        var channel = res.match[2].trim()
        var userid = res.message.user.id
        updateChannel(userid, channel, 'defaultStandup')
    })

    robot.on('changeStandupChannel', function (data, res) {
        var channel = data.parameters.channelName
        var userid = res.message.user.id
        updateChannel(userid, channel, 'defaultStandup')
    })


    robot.respond(/standup (edit|change|modify|update) time ?t?o? (.*)/i, function (res) {
        var time = res.match[2].trim()
        var userid = res.message.user.id
        if (!isTimeValid(time)) {
            res.reply('Sorry but this is not a valid time. Try again using this `HH:MM` 24h-format.')
        } else {
            updateTime(userid, 'defaultStandup', time)
        }
    })

    robot.on('changeStandupTime', function (data, res) {
        var time = data.parameters.time
        var userid = res.message.user.id
        if (!isTimeValid(time)) {
            res.reply('Sorry but this is not a valid time. Try again using this `HH:MM` 24h-format.')
        } else {
            updateTime(userid, 'defaultStandup', time)
        }
    })


    robot.respond(/standup (edit|change|modify|update) days ?t?o? (.*)/i, function (res) {
        // trim and replace spaces
        var days = res.match[2].trim().replace(/\s/g, '');
        changeDaysListener(res, days)
    })

    robot.on('changeStandupDays', function (data, res) {
        var days = data.parameters.days.toString()
        changeDaysListener(res, days)
    })

    function changeDaysListener(res, days) {
        var userid = res.message.user.id
        var cronDays = getCronDays(days)
        if (!isCronDaysValid(cronDays)) {
            res.reply('Sorry but this is not a valid input. Try again someting like `Monday, Wednesday - Friday`.')
        } else {
            updateDays(userid, 'defaultStandup', cronDays)
        }
    }


    robot.respond(/standup add question "(.*)" to ([0-9]*)( with (.*))?/i, function (res) {
        var text = res.match[1].trim()
        var questionIndex = parseInt(res.match[2]) - 1
        var colorName = res.match[4]
        var questionObj = { text: text, color: color.getHex(colorName) }
        addStandupQuestionListener(res, questionObj, questionIndex)
    })

    robot.on('addStandupQuestion', function (data, res) {
        var text = data.parameters.text
        var questionIndex = data.parameters.index - 1
        var colorName = data.parameters.color
        if (!questionIndex) {
            questionIndex = 0
        }
        var questionObj = { text: text, color: color.getHex(colorName) }
        addStandupQuestionListener(res, questionObj, questionIndex)
    })

    function addStandupQuestionListener(res, questionObj, questionIndex, standupId = 'defaultStandup') {
        pushQuestion(standupId, questionObj, questionIndex).then((standup) => {
            var msg = { attachments: [] }
            msg.text = `${res.message.user.name} added a new standup question`
            msg.attachments.push({
                text: questionObj.text,
                color: questionObj.color
            })
            robot.messageRoom(standup.channel, msg)
            res.reply('Question added to the standup.')
        }).catch(e => {
            res.reply(e.message)
        })
    }


    robot.respond(/standup (remove|delete) question ([0-9]*)/i, function (res) {
        var questionIndex = parseInt(res.match[2]) - 1
        removeStandupQuestionListener(res, questionIndex)
    })

    robot.on('removeStandupQuestion', function (data, res) {
        var questionIndex = data.parameters.index - 1
        removeStandupQuestionListener(res, questionIndex)
    })

    function removeStandupQuestionListener(res, questionIndex, standupId = 'defaultStandup') {
        pullQuestion('defaultStandup', questionIndex).then(standup => {
            var msg = { attachments: [] }
            msg.text = `${res.message.user.name} removed a standup question`
            msg.attachments.push({
                text: standup.questions[questionIndex].text,
                color: standup.questions[questionIndex].color
            })
            robot.messageRoom(standup.channel, msg)
            res.reply('Question ' + bold(standup.questions[questionIndex].text) + ' removed as you requested.')
        }).catch(e => {
            robot.logger.error(e)
            res.reply('I couldn\'t process your request. :/')
        })
    }


    robot.respond(/standup (change|update|modify|edit) question'?s? (\d+) colou?r to (.*)/, function (res) {
        var questionIndex = parseInt(res.match[2]) - 1
        var colorHex = color.getHex(res.match[3].trim())
        var updateObj = { color: colorHex }
        changeStandupQuestionColorListener(res, questionIndex, updateObj)
    })

    robot.on('changeStandupQuestionColor', function (data, res) {
        var questionIndex = data.parameters.index - 1
        var colorHex = color.getHex(data.parameters.color)
        var updateObj = { color: colorHex }
        changeStandupQuestionColorListener(res, questionIndex, updateObj)
    })

    function changeStandupQuestionColorListener(res, questionIndex, updateObj, standupId = 'defaultStandup') {
        updateQuestion(standupId, questionIndex, updateObj)
            .then(standup => {
                var msg = { attachments: [] }
                msg.text = `${res.message.user.name} change standup question ${questionIndex + 1} color`
                msg.attachments.push({
                    text: standup.questions[questionIndex].text,
                    color: updateObj.color
                })
                robot.messageRoom(standup.channel, msg)
                res.reply('That was easy!')
            }).catch(e => {
                robot.logger.error(e)
                res.reply('An error occured. Check `standup settings` to see if the changes applied normally.')
            })
    }


    robot.respond(/standup (change|update|modify|edit) question'?s? ([0-9]*) text to "?(.*)"?/, function (res) {
        var questionIndex = parseInt(res.match[2]) - 1
        var questionText = res.match[3]
        var updateObj = { index: questionIndex, text: questionText }
        changeStandupQuestionTextListener(res, questionIndex, updateObj)
    })

    robot.on('changeStandupQuestionText', function (data, res) {
        var questionIndex = data.parameters.index - 1
        var questionText = data.parameters.text
        var updateObj = { index: questionIndex, text: questionText }
        changeStandupQuestionTextListener(res, questionIndex, updateObj)
    })

    function changeStandupQuestionTextListener(res, questionIndex, updateObj, standupId = 'defaultStandup') {
        updateQuestion(standupId, questionIndex, updateObj)
            .then(standup => {
                var msg = { attachments: [] }
                msg.text = `${res.message.user.name} change standup question ${questionIndex + 1} text`
                msg.attachments.push({
                    text: updateObj.text,
                    color: standup.questions[questionIndex].color
                })
                robot.messageRoom(standup.channel, msg)
                res.reply('That was easy!')
            }).catch(e => {
                robot.logger.error(e)
                res.reply('An error occured. Check `standup settings` to see if the changes applied normally.')
            })
    }

    robot.respond(/standup (move) question'?s? ([0-9]*) to ([0-9]*)/, function (res) {
        var questionIndex = parseInt(res.match[2]) - 1
        var newIndex = parseInt(res.match[3]) - 1
        questionsRearrangeListener(res, questionIndex, newIndex)
    })

    robot.on('rearrangeStandupQuestions', function (data, res) {
        var questionIndex = data.parameters.questionIndex - 1
        var newIndex = data.parameters.newIndex - 1
        questionsRearrangeListener(res, questionIndex, newIndex)
    })

    function questionsRearrangeListener(res, questionIndex, newIndex, standupId = 'defaultStandup') {
        updateQuestionIndex(standupId, questionIndex, newIndex).then(data => {
            var channel = data.value.channel
            robot.messageRoom(channel, `${res.message.user.name} rearranged the order of the standup's questions ${questionIndex + 1} and ${newIndex + 1}`)
            res.reply('Standup\'s questions rearranged as you asked.')
        }).catch(error => {
            res.reply('An error occured. Check `standup settings` to see if the changes applied normally.')
        })
    }


    robot.respond(/standup reset/i, function (res) {
        resetStandupListener(res)

    })

    robot.on('resetStandup', function ({ }, res) {
        resetStandupListener(res)
    })

    function resetStandupListener(res, standupId = 'defaultStandup') {
        var username = res.message.user.name
        resetStandup('defaultStandup').then(channel => {
            robot.messageRoom(channel, 'Standup configuration reset by ' + username
                + '.\nSay `standup show settings` to see current standup configuration.')
            res.reply('Standup configuration reset successfully. \nSay `standup show settings` to see current configuration.')
            return channel
        }).catch(error => {
            res.reply('I couldn\'t process your request. :/')
            robot.logger.error(error)
        })
    }


    robot.on(/updateStandupsCronJobs/, function (res) {
        updateStandupsCronJobs()
    })


    /*************************************************************************/
    /*                          standups Handling                            */
    /*************************************************************************/


    function initDefaultStandup() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').insertAsync(c.defaultStandup)
            .then(data => {
            })
            .catch(error => {
                if (error.code != 11000) {
                    robot.logger.error(error)
                    if (c.errorsChannel) {
                        robot.messageRoom(c.errorsChannel, c.errorMessage + `Script: ${path.basename(__filename)}`)
                    }
                }
            })
    }

    function resetStandup(standupid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').findOneAndDeleteAsync({ _id: standupid })
            .then((result) => {
                initDefaultStandup()
                return result.value.channel
            })
            .then((channel) => {
                updateStandupsCronJobs()
                return channel
            })
            .catch(error => {
                return Promise.reject(error)
            })
    }

    // getAllStandupsData(): fetch all standups' data  ==>  createCronJob(): create cron jobs for every single standup
    // This function is being called every time the bot initializes (i.e. the very first time or after code changes and deployment)
    function getAllStandupsData() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').find().toArrayAsync()
            .then(dbData => {
                createCronJobs(dbData)
            })
            .catch(dbError => {
                //TODO
            })
    }

    // cronJob started ==> getStandupData(): fetch data of a single standup ==> startReport(): QnA to users
    // This function is being called every time a cronJob runs to fetch standup's data (questions & channel) and start the report. 
    /* Notes: 
     * Whenever providing a userid parameter, the standup excecutes for that specific user only or channel's user if the id is for channel. 
     * Otherwise is excecuted for all the users that belong to the specified channel of the given standupid */
    function getStandupData(standupId, userid = null) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)

        db.bind('standups').findOneAsync({ _id: standupId })
            .then(standupData => {

                if (!userid) { // this is actually for scheduled standups
                    try {
                        // this is for public channels
                        var channelMembers = (robot.adapter.client.rtm.dataStore.getChannelByName(standupData.channel)).members
                    } catch (error) {
                        // this is for private channels in case we don't have a public one
                        var channelMembers = (robot.adapter.client.rtm.dataStore.getGroupByName(standupData.channel)).members
                    }

                    channelMembers.forEach(function (id) {
                        var user = robot.brain.userForId(id)
                        if (!user[robot.adapterName].is_bot && !user[robot.adapterName].is_app_user) {
                            startReport(id, standupData, 0)
                        }
                    })
                }
                else if (userid[0] != 'D' && userid[0] != 'U') { // if it's not a Direct Message (tested on slack only).
                    // 'C' stands for public (C)hannel where 'G' is for private (G)roup
                    if (userid[0] == 'C') {
                        var channelMembers = (robot.adapter.client.rtm.dataStore.getChannelById(userid)).members
                    }
                    else if (userid[0] == 'G') {
                        var channelMembers = (robot.adapter.client.rtm.dataStore.getGroupById(userid)).members
                    }
                    else {
                        return -1
                    }

                    channelMembers.forEach(function (id) {
                        var user = robot.brain.userForId(id)
                        if (!user[robot.adapterName].is_bot && !user[robot.adapterName].is_app_user) {
                            startReport(id, standupData, 0)
                        }
                    })
                }
                else {
                    startReport(userid, standupData, 0)
                }
            })
            .catch(dbError => {
                robot.logger.error(dbError)
                if (c.errorsChannel) {
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
                }
            })
    }


    // TODO: could be replaced with dynamic-dialog.js in the future
    // This function is responsible for posting a standup's questions to the users and getting the answers. 
    function startReport(userid, standup, qstCnt) {

        // try-catch in case of zero questions (when users delete them all)
        try {
            var question = standup.questions[qstCnt].text
            var attachmentColor = standup.questions[qstCnt].color
            var questionsNum = standup.questions.length
        } catch (error) {
            robot.logger.warning('Standup force stopped due to lack of questions.')
            return 0
        }


        var msg = {
            message: {
                user: { id: userid }
            },
            reply: function (text) {
                robot.messageRoom(userid, text)
            }
        }

        var timeout = c.standups.timeout
        var dialog = switchBoard.startDialog(msg, timeout)
        msg.reply(`*${standup.name}* ${question}`)
        var regex = new RegExp(robot.name + " (.*)", "i")
        dialog.addChoice(regex, function (msg2) {

            var answer = msg2.match[1]

            // save the answer in cache
            cache.union(`${userid}.${standup.name}`, { q: question, a: answer, c: attachmentColor })

            // move to next question 
            dialog.finish()
            qstCnt++
            if (['cancel', 'stop', 'abort', 'exit', 'quit'].includes(answer)) {
                robot.messageRoom(userid, 'You have cancelled the standup report. You can start whenever you want by saing `start standup`. ')
                delete cache.data[userid][standup.name]
                return 0
            }
            else if (qstCnt < standup.questions.length) {
                startReport(userid, standup, qstCnt)
            }
            else {
                var user = robot.brain.userForId(userid).real_name
                var username = robot.brain.userForId(userid).name

                var reportMsg = { attachments: [] }
                var report = cache.data[userid][standup.name]

                msg.reply(`Thanks for reporting on ${standup.name} standup! Keep up the good work :wink:`)

                // Display standup in channel
                Promise.each(report, function (element) {
                    var attachment = slackMsg.attachment()
                    attachment.title = element.q
                    attachment.text = element.a
                    attachment.color = element.c
                    reportMsg.attachments.push(attachment)
                }).then(() => {
                    var date = dateFormat(new Date(), "dd/mm/yyyy")
                    reportMsg.text = `*${user}* (${username}) posted a status update for *${date}* on *${standup.name}* standup`
                    robot.messageRoom(standup.channel, reportMsg)
                }).catch(err => {
                    console.log(err)
                })


                // TODO (Feature): Save in DB

                // delete after save in DB
                delete cache.data[userid][standup.name]
            }
        })
    }

    // set query = {} to get All the stored standups
    function showStandups(userid, query = { _id: 'defaultStandup' }) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').find(query).toArrayAsync() // Although we have a single standup, we are using Array for future feature of having multiple standups
            .then(allStandups => {
                var msg = { attachments: [] }
                Promise.each(allStandups, function (standup) {
                    var attachment = slackMsg.attachment()

                    attachment.pretext = `Standup *${standup.name}* for Channel *${standup.channel}*`
                    attachment.fields.push({
                        title: "Time",
                        value: standup.time,
                        short: true
                    })
                    attachment.fields.push({
                        title: "Days",
                        value: getDaysNames(standup.days),
                        short: true
                    })
                    attachment.fields.push({
                        title: "Active",
                        value: (standup.active).toString(),
                        short: true
                    })
                    attachment.fields.push({
                        title: "Channel",
                        value: standup.channel,
                        short: true
                    })
                    if (standup.active) {
                        attachment.color = 'good'
                    } else {
                        attachment.color = 'danger'
                    }
                    msg.attachments.push(attachment)

                    for (var i = 0; i < standup.questions.length; i++) {
                        var qAttachment = slackMsg.attachment()

                        qAttachment.text = `${i + 1}. ${standup.questions[i].text}`
                        qAttachment.color = standup.questions[i].color

                        msg.attachments.push(qAttachment)
                    }
                }).then(() => {
                    robot.messageRoom(userid, msg)
                }).catch(error => {
                    robot.logger.error(error)
                })
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }


    /*************************************************************************/
    /*                      standups updating functions                      */
    /*************************************************************************/

    function updateChannel(userid, channel, standupid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').findAndModifyAsync(
            { _id: standupid },
            [["_id", 1]],
            { $set: { channel: channel } })
            .then(standup => {
                updateStandupsCronJobs()
                return { channel: standup.value.channel, name: standup.value.name }
            }).then((standup) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Standup channel successfully changed.`)
                robot.messageRoom('#' + standup.channel, `Standup *${standup.name}* channel changed to *${channel}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    // TODO: updateTime() and updateDays() could be possibly merged  
    function updateTime(userid, standupid, time) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').findAndModifyAsync(
            { _id: standupid },
            [["_id", 1]],
            { $set: { time: time } })
            .then(standup => {
                updateStandupsCronJobs()
                return { channel: standup.value.channel, name: standup.value.name }
            }).then((standup) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Standup time successfully changed.`)
                robot.messageRoom('#' + standup.channel, `Standup *${standup.name}* time changed to *${time}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateDays(userid, standupid, days) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').findAndModifyAsync(
            { _id: standupid },
            [["_id", 1]],
            { $set: { days: days } })
            .then(standup => {
                updateStandupsCronJobs()
                return { channel: standup.value.channel, name: standup.value.name }
            }).then((standup) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Standup days successfully changed.`)
                robot.messageRoom('#' + standup.channel, `Standup *${standup.name}* days changed to *${getDaysNames(days)}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateStandupStatus(userid, standupid, status) {
        if (status) {
            cronJobs[standupid].start()
        } else {
            cronJobs[standupid].stop()
        }

        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('standups').findAndModifyAsync(
            { _id: standupid },
            [["_id", 1]],
            { $set: { active: status } })
            .then(standup => {
                updateStandupsCronJobs()
                return { channel: standup.value.channel, name: standup.value.name }
            })
            .then(standup => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                var standup = standup
                var newStatus, oldStatus
                if (status == true) {
                    newStatus = 'activated'
                    oldStatus = 'deactivate'
                }
                else {
                    newStatus = 'deactivated'
                    oldStatus = 'activate'
                }
                robot.messageRoom('#' + standup.channel, `${realname} (${username}) *${newStatus}* ${standup.name} standup.`)
                showStandups(standup.channel, { _id: 'defaultStandup' })
                robot.messageRoom(standup.channel, `You can ${oldStatus} again by saying ` + '`activate standup`')
                robot.messageRoom(userid, `Standup ${standup.name} ${newStatus} successfully.`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }



    // adds a new question to the specified standup
    function pushQuestion(standupid, questionObj, questionIndex) {
        if (questionIndex < 0) {
            questionIndex = 0
        }
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').findOneAndUpdateAsync(
            { _id: standupid },
            {
                $push: {
                    questions: {
                        $each: [questionObj],
                        $position: questionIndex
                    }
                }
            })
            .then((standup) => {
                return standup.value
            }).catch(error => {
                robot.logger.error(error)
                return Promise.reject(error)
            })
    }

    // removes a question to the specified standup
    function pullQuestion(standupid, questionIndex) {
        if (questionIndex < 0) {
            questionIndex = 0
        }
        var unsetObj = {}
        unsetObj['questions.' + questionIndex] = 1

        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').findOneAndUpdateAsync({ _id: 'defaultStandup' }, { $unset: unsetObj })
            .then(db.standups.findOneAndUpdateAsync(
                { _id: 'defaultStandup' },
                {
                    $pull:
                    { "questions": null }
                }))
            .then(standup => {
                return standup.value
            })
            .catch(error => {
                return Promise.reject(error.message)
            })
    }

    function updateQuestion(standupid, questionIndex, updateObj) {
        if (questionIndex < 0) {
            questionIndex = 0
        }

        var setObj = {}
        var existsObj = {}

        // update only if that array element exists
        existsObj["questions." + questionIndex] = { $exists: true }

        // set the new values
        if (updateObj.color) {
            setObj[`questions.${questionIndex}.color`] = updateObj.color
        }
        else if (updateObj.text) {
            setObj[`questions.${questionIndex}.text`] = updateObj.text
        }
        else if (updateObj.newIndex) {
            setObj[`questions.${questionIndex}.order`] = updateObj.newIndex
        }

        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').findOneAndUpdateAsync(
            {
                $and: [
                    { _id: standupid },
                    existsObj
                ]
            },
            {
                $set: setObj
            })
            .then(data => {
                return data.value
            })
            .catch(error => {
                return Promise.reject(error)
            })
    }


    function updateQuestionIndex(standupid, oldIndex, newIndex) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standups').find({ _id: standupid }).toArrayAsync()
            .then(standup => {
                var questions = standup[0].questions
                if (questions.length - 1 < oldIndex) {
                    oldIndex = questions.length - 1
                }
                if (questions.length - 1 < newIndex) {
                    newIndex = questions.length - 1
                }
                var tmpQuestion = questions[newIndex]
                questions[newIndex] = questions[oldIndex]
                questions[oldIndex] = tmpQuestion
                return db.standups.findOneAndUpdateAsync({ _id: standupid }, { $set: { questions: questions } })
            })
            .catch(error => {
                return robot.logger.error(error)
            })
    }


    /*************************************************************************/
    /*                          cronJobs Handling                            */
    /*************************************************************************/

    var cronJobs = {}

    // standup Data -> cronJobs
    function createCronJobs(data) {
        data.forEach(function (standup) {
            var days = standup.days
            var time = standup.time.split(':')
            var standupId = standup._id
            // TODO days
            cronJobs[standup._id] = new CronJob(`00 ${time[1]} ${time[0]} * * ${days}`, /* ss mm hh daysOfMonth MM daysOFWeek */
                function () { /* This function is executed when the job starts */
                    getStandupData(standupId)
                },
                function () {
                    return null
                },               /* This function is executed when the job stops */
                standup.active,           /* Start the job right now */
                'Europe/Athens' /* Time zone of this job. */
            )
        })
    }

    // stop all the previous jobs and reset them with the new settings
    function updateStandupsCronJobs() {
        Promise.each(Object.keys(cronJobs),
            function (standupId) {
                cronJobs[standupId].stop()
            })
            .then(() => {
                getAllStandupsData()
            })
            .catch(err => {
                robot.logger.error(error)
                if (c.errorsChannel) {
                    robot.messageRoom(c.errorsChannel, c.errorMessage + `Script: ${path.basename(__filename)}`)
                }
            })
    }

    /*************************************************************************/
    /*                           helpful functions                           */
    /*************************************************************************/


    function bold(text) {
        if (robot.adapterName == 'slack') {
            return `*${text}*`
        }
        // Add any other adapters here  
        else {
            return text
        }
    }

    function getCronDays(days) {
        days = days.toLowerCase()
        if (['everyday', 'all', 'every day'].includes(days)) {
            return '*'
        }
        else if (days == 'weekdays') {
            return '1-5'
        }
        else {
            var daysArray = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            for (var i = 0; i < 7; i++) {
                days = days.replace(daysArray[i], i)
                days = days.replace(daysArray[i].substring(0, 3), i)
            }
            return days
        }
    }

    function getDaysNames(cronDay) {
        if (cronDay == '*') {
            return 'Every Day'
        }
        else {
            var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            for (var i = 0; i < 7; i++) {
                cronDay = cronDay.replace(i, days[i])
            }
            return cronDay
        }
    }

    function isTimeValid(time) {
        var validateTimePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/
        return validateTimePattern.test(time);
    }


    function isCronDaysValid(days) {
        var validateDayPattern = /^[^a-zA-Z]+$/
        return validateDayPattern.test(days);
    }

}