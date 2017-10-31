// Commands:
//   `github sumups info|settings` - View GitHub sumups settings.  
//   `github sumups change|edit|update channel (to) <channel_name>` - Change GitHub sumups channel.
//   `github sumups change|edit|update time (to) <HH:MM>` - Change GitHub sumups time.
//   `github sumups change|edit|update days (to) <days>` - Change GitHub sumups days.
//   `github sumups pause|deactivate|disable` - Disable GitHub sumups scheduler.
//   `github sumups resume|activate|enable` - Enable GitHub sumups scheudler. 

var CronJob = require('cron').CronJob;
var mongoskin = require('mongoskin')
var Promise = require('bluebird')
var slackMsg = require('./slackMsgs.js')
var path = require('path')
var cache = require('./cache.js').getCache()
var async = require('async')
var c = require('./config.json')

// config
var mongodb_uri = process.env.MONGODB_URL
if (!mongodb_uri){
    return
}
module.exports = (robot) => {

    async.series([
        function (done) {
            initDefaultSumUp()
            done()
        },
        function (done) {
            getGithubSumUpData()
        }
    ])



    /*************************************************************************/
    /*                             Listeners                                 */
    /*************************************************************************/

    robot.respond(/github sum-?ups?( show| get| give me|) (info|settings)/i, function (res) {
        var userid = res.message.user.id
        showSumupInfo(userid)
    })

    robot.respond(/github sum-?ups? (change|edit|update|modify) channel t?o? (.*)/i, function (res) {
        var channel = res.match[2].trim()
        var userid = res.message.user.id
        updateChannel(userid, channel)
    })

    robot.respond(/github sum-?ups? (change|edit|update|modify) time t?o? (.*)/i, function (res) {
        var time = res.match[2].trim()
        var userid = res.message.user.id
        if (!isTimeValid(time)) {
            res.reply('Sorry but this is not a valid time. Try again using this `HH:MM` 24h-format.')
        } else {
            updateTime(userid, time)
        }
    })


    /** Change the days of the github sumup scheduler **/
    robot.respond(/github sum-?ups? (edit|change|modify|update) days ?t?o? (.*)/i, function (res) {
        var days = res.match[2].trim().replace(/(and)/gi, ',').replace(/\s/g, '')  // remove spaces
        var userid = res.message.user.id
        var cronDays = getCronDays(days)
        if (!isCronDaysValid(cronDays)) {
            res.reply('Sorry but this is not a valid input. Try again someting like `Monday, Wednesday - Friday`.')
        } else {
            updateDays(userid, cronDays)
        }
    })

    robot.on('changeGithubSumupDays', function (result, res) {
        var days = result.parameters.days.toString()
        changeGithubSumupDaysListeners(days, res)
    })

    function changeGithubSumupDaysListeners(days, res) {
        var userid = res.message.user.id
        var cronDays = getCronDays(days)
        if (!isCronDaysValid(cronDays)) {
            res.reply('Sorry but this is not a valid input. Try again someting like `Monday, Wednesday - Friday`.')
        } else {
            updateDays(userid, cronDays)
        }
    }

    /** Deactivate/Activate github sumups auto-post scheduler **/
    robot.respond(/github sum-?ups? (pause|deactivate|disable)/i, function (res) {
        var userid = res.message.user.id
        updateSumupStatus(userid, false)
    })

    robot.respond(/github sum-?ups? (resume|activate|enable)/i, function (res) {
        var userid = res.message.user.id
        updateSumupStatus(userid, true)
    })

    robot.on('changeGithubSumupsStatus', function (result, res) {
        var userid = res.message.user.id
        var newStatus = result.parameters.bool
        updateSumupStatus(userid, newStatus)
    })



    /*************************************************************************/
    /*                          sumups Handling                              */
    /*************************************************************************/

    function showSumupInfo(userid, sumupId = 'defaultSumUp') {
        var msg = { attachments: [] }
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findOneAsync({ _id: sumupId }) // Although we have a single sumup, we are using Array for future feature of having multiple sumups
            .then(sumup => {
                var attachment = slackMsg.attachment()

                attachment.pretext = `Github SumUps auto-post Scheduler Info`
                attachment.fields.push({
                    title: "Time",
                    value: sumup.time,
                    short: true
                })
                attachment.fields.push({
                    title: "Days",
                    value: getDaysNames(sumup.days),
                    short: true
                })
                attachment.fields.push({
                    title: "Active",
                    value: (sumup.active).toString(),
                    short: true
                })
                attachment.fields.push({
                    title: "Channel",
                    value: sumup.channel,
                    short: true
                })
                if (sumup.active) {
                    attachment.color = 'good'
                } else {
                    attachment.color = 'danger'
                }
                msg.attachments.push(attachment)
            })
            .then(() => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                robot.logger.error(error)
            })
    }

    function initDefaultSumUp() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').insertAsync(c.defaultGithubSumUp)
            .then(() => {
                robot.logger.info('Default Github SumUps Initialized')
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

    function getGithubSumUpData() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findOneAsync()
            .then(dbData => {
                createCronJob(dbData)
            })
            .catch(error => {
                robot.logger.error(error)
                if (c.errorsChannel) {
                    robot.messageRoom(c.errorsChannel, c.errorMessage + `Script: ${path.basename(__filename)}`)

                }
            })
    }

    // Gets all the users' IDs and emits an event for SumUp posting to each user
    function githubSumUpScheduler() {
        var userIDs = cache.get('userIDs')
        Promise.each(userIDs, function (userid) {
            var query
            var lastGithubSumupDate = cache.get(userid, 'github_last_sumup_date')
            if (!lastGithubSumupDate) {
                var date = new Date()
                var yesterday = new Date(date.setDate(date.getDate() - 1)).toISOString()
                query = {
                    state: 'open',
                    since: yesterday
                }
            } else {
                query = {
                    state: 'open',
                    since: lastGithubSumupDate
                }
            }
            robot.emit('githubSumUp', userid, query, true)
        })
    }

    /*************************************************************************/
    /*                        sumups updating functions                      */
    /*************************************************************************/

    function updateSumupStatus(userid, status, sumupId = 'defaultSumUp') {
        if (status) {
            cronJobs[sumupId].start()
        } else {
            cronJobs[sumupId].stop()
        }

        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { active: status } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            })
            .then(channel => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                var newStatus, oldStatus
                if (status) {
                    newStatus = 'activated'
                    oldStatus = 'deactivate'
                } else {
                    newStatus = 'deactivated'
                    oldStatus = 'activate'
                }
                robot.messageRoom('#' + channel, `${realname} (${username}) *${newStatus}* Github Sumups.`)
                showSumupInfo(channel, sumupId)
                robot.messageRoom(channel, `You can ${oldStatus} again by saying ` + '`' + oldStatus + ' github sumup`')
                robot.messageRoom(userid, `Github-SumUp ${newStatus} succesfully.`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateChannel(userid, channel, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { channel: channel } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((oldChannel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Github-Sumup channel succesfully changed.`)
                robot.messageRoom('#' + oldChannel, `Github-Sumup channel changed to *${channel}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateTime(userid, time, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { time: time } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((channel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Github-Sumup time succesfully changed.`)
                robot.messageRoom('#' + channel, `Github-Sumup time changed to *${time}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateDays(userid, days, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('githubSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { days: days } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((channel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Github-Sumup time succesfully changed.`)
                robot.messageRoom('#' + channel, `Github-Sumup days changed to *${getDaysNames(days)}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    /*************************************************************************/
    /*                        CronJobs Handling                              */
    /*************************************************************************/

    var cronJobs = {}

    function createCronJob(sumup) {
        var time = sumup.time.split(':')
        var days = sumup.days

        cronJobs[sumup._id] = new CronJob(`00 ${time[1]} ${time[0]} * * ${days}`,
            function () {
                githubSumUpScheduler()
            },
            function () {
                return null
            }, /* This function is executed when the job stops */
            sumup.active, /* Start the job right now */
            'Europe/Athens' /* Time zone of this job. */
        )
    }

    // stop all the previous jobs and reset them with the new settings (from db)
    function updateSumupsCronJobs() {
        Promise.each(Object.keys(cronJobs),
            function (sumuId) {
                cronJobs[sumuId].stop()
            })
            .then(() => {
                getGithubSumUpData()
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