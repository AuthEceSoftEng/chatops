// Commands:
//   `trello sumups info`
//   `trello sumups change|edit|update channel (to) <channel_name>`
//   `trello sumups change|edit|update time (to) <HH:MM>`
//   `trello sumups change|edit|update days (to) <days>`
//   `trello sumups pause|deactivate|disable`
//   `trello sumups resume|activate|enable`

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
if (!mongodb_uri) {
    return
}

module.exports = (robot) => {

    async.series([
        function (done) {
            initDefaultSumUp()
            done()
        },
        function (done) {
            getTrelloSumUpData()
        }
    ])



    /*************************************************************************/
    /*                             Listeners                                 */
    /*************************************************************************/

    robot.respond(/trello sum-?up'?s? (show|get|give me|)info/i, function (res) {
        var userid = res.message.user.id
        showSumupInfo(userid)
    })

    robot.respond(/trello sum-?ups? (change|edit|update|modify) channel t?o? (.*)/i, function (res) {
        var channel = res.match[2].trim()
        var userid = res.message.user.id
        updateChannel(userid, channel)
    })

    robot.respond(/trello sum-?ups? (change|edit|update|modify) time t?o? (.*)/i, function (res) {
        var time = res.match[2].trim()
        var userid = res.message.user.id
        if (!isTimeValid(time)) {
            res.reply('Sorry but this is not a valid time. Try again using this `HH:MM` 24h-format.')
        } else {
            updateTime(userid, time)
        }
    })


    /** Change the days of the trello sumup scheduler **/
    robot.respond(/trello sum-?ups? (edit|change|modify|update) days ?t?o? (.*)/i, function (res) {
        var days = res.match[2].trim().replace(/(and)/gi, ',').replace(/\s/g, '')  // remove spaces
        var userid = res.message.user.id
        var cronDays = getCronDays(days)
        if (!isCronDaysValid(cronDays)) {
            res.reply('Sorry but this is not a valid input. Try again someting like `Monday, Wednesday - Friday`.')
        } else {
            updateDays(userid, cronDays)
        }
    })

    robot.on('changeTrelloSumupDays', function (result, res) {
        var days = result.parameters.days.toString()
        changeTrelloSumupDaysListeners(days, res)
    })

    /** Deactivate/Activate trello sumups auto-post scheduler **/
    robot.respond(/trello sum-?ups? (pause|deactivate|disable) sum-?ups?/i, function (res) {
        var userid = res.message.user.id
        updateSumupStatus(userid, false)
    })

    robot.respond(/trello sum-?ups? (resume|activate|enable) sum-?ups?/i, function (res) {
        var userid = res.message.user.id
        updateSumupStatus(userid, true)
    })

    robot.on('changeTrelloSumupsStatus', function (result, res) {
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
        db.bind('trelloSumUps').findOneAsync({ _id: sumupId }) // Although we have a single sumup, we are using Array for future feature of having multiple sumups
            .then(sumup => {
                var attachment = slackMsg.attachment()

                attachment.pretext = `Trello SumUps auto-post Scheduler Info`
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
        db.bind('trelloSumUps').insertAsync(c.defaultTrelloSumUp)
            .then(() => {
                robot.logger.info('Default Trello SumUps Initialized')
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

    function getTrelloSumUpData() {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('trelloSumUps').findOneAsync()
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
    function trelloSumUpScheduler() {
        var userIDs = cache.get('userIDs')
        Promise.each(userIDs, function (userid) {
            var query
            var lastTrelloNotificationID = cache.get(userid, 'trello_last_notification')
            if (!lastTrelloNotificationID) {
                query = { read_filer: 'unread' }
            } else {
                query = { since: lastTrelloNotificationID }
            }
            robot.emit('trelloSumUp', userid, query, true) // robot.on in trello-integration.js file
        })
    }

    /*************************************************************************/
    /*                        sumups updating functions                      */
    /*************************************************************************/

    function changeTrelloSumupDaysListeners(days, res) {
        var userid = res.message.user.id
        var cronDays = getCronDays(days)
        if (!isCronDaysValid(cronDays)) {
            res.reply('Sorry but this is not a valid input. Try again someting like `Monday, Wednesday - Friday`.')
        } else {
            updateDays(userid, cronDays)
        }
    }

    function updateSumupStatus(userid, status, sumupId = 'defaultSumUp') {
        if (status) {
            cronJobs[sumupId].start()
        } else {
            cronJobs[sumupId].stop()
        }

        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('trelloSumUps').findAndModifyAsync(
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
                robot.messageRoom('#' + channel, `${realname} (${username}) *${newStatus}* Trello Sumups.`)
                showSumupInfo(channel, sumupId)
                robot.messageRoom(channel, `You can ${oldStatus} again by saying ` + '`' + oldStatus + ' trello sumup`')
                robot.messageRoom(userid, `Trello-SumUp ${newStatus} succesfully.`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateChannel(userid, channel, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('trelloSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { channel: channel } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((oldChannel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Trello-Sumup channel succesfully changed.`)
                robot.messageRoom('#' + oldChannel, `Trello-Sumup channel changed to *${channel}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateTime(userid, time, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('trelloSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { time: time } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((channel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Trello-Sumup time succesfully changed.`)
                robot.messageRoom('#' + channel, `Trello-Sumup time changed to *${time}* by ${realname} (${username})`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, c.errorMessage + `Script: ${path.basename(__filename)}`)
            })
    }

    function updateDays(userid, days, sumupId = 'defaultSumUp') {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        db.bind('trelloSumUps').findAndModifyAsync(
            { _id: sumupId },
            [["_id", 1]],
            { $set: { days: days } })
            .then(sumup => {
                updateSumupsCronJobs()
                return sumup.value.channel
            }).then((channel) => {
                var username = robot.brain.userForId(userid).name
                var realname = robot.brain.userForId(userid).real_name
                robot.messageRoom(userid, `Trello-Sumup time succesfully changed.`)
                robot.messageRoom('#' + channel, `Trello-Sumup days changed to *${getDaysNames(days)}* by ${realname} (${username})`)
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
                trelloSumUpScheduler()
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
                getTrelloSumUpData()
            })
            .catch(error => {
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
/**********************************************************/
// OLD STUFF - TO BE DELETED
// left for some possible useful code snippets

// var key = process.env.HUBOT_TRELLO_KEY;
// var Promise = require('bluebird');
// var Trello = require('node-trello');
// var message = require('./slackMsgs.js');
// var c = require('./colors.js');

// module.exports = function (robot) {
//     var db = require('./mlab-login.js').db();
//     var encryption = require('./encryption.js');
//     var CronJob = require('cron').CronJob;
//     var job = new CronJob('00 05 20 * * *',
//         function () {
//             robot.logger.info('cron job running on trello-notifications.js');
//             trelloNotifications();
//         },
//         function () { }, /* This function is executed when the job stops */
//         true, /* Start the job right now */
//         'Europe/Athens' /* Time zone of this job. */
//     );

//     // check if trello notifications feature is enabled
//     // db.bind('settings');
//     // db.settings.find().toArrayAsync().then(dbData => {
//     //     if (dbData.trelloNotifications) {
//     //         job.start();
//     //     } else {
//     //         // job.stop();
//     //     }
//     // }).catch(dbError => {
//     //     robot.logger.info(dbError)
//     // });

//     // trelloNotifications(); //for debugging -> MUST DELETE THIS AT THE END OF DEVELOPMENT
//     function trelloNotifications() {
//         db.bind('trelloTokens');
//         db.trelloTokens.find().toArrayAsync().then(dbData => {
//             var usersNum = dbData.length;
//             for (let i = 0; i < usersNum; i++) { // i: the number of authorized trello users
//                 var encryptedToken = dbData[i].token;
//                 encryption.decrypt(encryptedToken).then(token => {
//                     var trello = Promise.promisifyAll(new Trello(key, token));
//                     var args = { read_filter: 'unread' }; // get only the unread notifications

//                     trello.getAsync('/1/member/me/notifications', args).then(notif => {
//                         if (notif.length > 0) {
//                             let msg = getMsg(notif);
//                             let userId = dbData[i].id;      // get user's id (on chat platform)
//                             robot.messageRoom(userId, msg); // send message to that user
//                         }
//                     }).catch(trError => {
//                         robot.messageRoom('general', 'trError on scheduler.js. Please check server log');
//                         robot.logger.error(trError);
//                     })
//                 })
//             }
//         }).catch(dbError => {
//             robot.messageRoom('general', 'dbError on scheduler.js. Please check server log');
//             robot.logger.error(dbError)
//         })
//     }

//     function getMsg(notif) {
//         var msg = { attachments: [] };
//         var notifNum = notif.length;

//         for (let j = 0; j < notifNum; j++) { // j: the number of notifications per user
//             let attachment = message.attachment();
//             let type, creator, text, pretext, cardUrl, cardName, listName, color;
//             if (notif[j].memberCreator)
//                 creator = notif[j].memberCreator.username;
//             cardUrl = `https://trello.com/c/${notif[j].data.card.shortLink}`;
//             cardName = notif[j].data.card.name;

//             switch (notif[j].type) {
//                 // case 'addAdminToBoard':
//                 // case 'addAdminToOrganization':
//                 // case 'addedAttachmentToCard':
//                 // case 'addedMemberToCard':
//                 // case 'addedToBoard':
//                 // case 'addedToCard':
//                 // case 'addedToOrganization':
//                 //     break;
//                 case 'cardDueSoon':
//                 case 'changeCard':
//                     // listName = (notif[j].data.listBefore || notif[j].data.list)['name'];
//                     // type = notif[j].type.split(/(?=[A-Z])/).join(" ").toLowerCase(); // split capitals, join and convert to lowercase 
//                     // creator = notif[j].memberCreator.username;
//                     // pretext = `Card <${cardUrl}|${cardName}> on list _${listName}_ updated by ${creator}`;
//                     // color = c.getColor('cyan');
//                     // if (notif[j].data.card.due != null) {
//                     //     let fullDate = getDate(notif[j].data.card.due);
//                     //     text = `*Due Date:* ${fullDate}`;
//                     // } else if (notif[j].data.listBefore) {
//                     //     text = `*Moved* to list: ${notif[j].data.listAfter.name}`;
//                     // }
//                     break;
//                 case 'closeBoard':
//                     break;
//                 case 'commentCard':
//                     pretext = `New comment on card <${cardUrl}|${cardName}> by ${creator}`
//                     text = notif[j].data.text
//                     break;
//                 // case 'createdCard':
//                 // case 'declinedInvitationToBoard':
//                 // case 'declinedInvitationToOrganization':
//                 // case 'invitedToBoard':
//                 // case 'invitedToOrganization':
//                 // case 'makeAdminOfBoard':
//                 // case 'makeAdminOfOrganization':
//                 // case 'memberJoinedTrello':
//                 // case 'mentionedOnCard':
//                 // case 'removedFromBoard':
//                 // case 'removedFromCard':
//                 // case 'removedFromOrganization':
//                 // case 'removedMemberFromCard':
//                 // case 'unconfirmedInvitedToBoard':
//                 // case 'unconfirmedInvitedToOrganization':
//                 // case 'updateCheckItemStateOnCard':
//                 // break;

//                 default:
//                     type = notif[j].type.split(/(?=[A-Z])/).join(" ").toLowerCase(); // split capitals, join and convert to lowercase 
//                     text = 'default';
//                     pretext = `${type} by ${creator}`;
//                     color = c.getColor('cyan');

//                     break;
//             }
//             attachment.text = text;
//             attachment.pretext = pretext;
//             attachment.color = color;
//             msg.attachments.push(attachment);
//         }
//         return msg;
//     }


//     function getDate(timestamp) {
//         var d = new Date(timestamp);
//         var options = {
//             year: "numeric", month: "long",
//             day: "numeric", hour: "2-digit", minute: "2-digit"
//         };
//         var str = d.toLocaleString("en-uk", options).split(',') // MMMM DD, YYYY, HH:MM PP 
//         var date = str[0];
//         var year = str[1];
//         var time = str[2];
//         var day = d.getDate()

//         // don't display year if due date year matches the current year
//         if (parseInt(year) === (new Date()).getFullYear()) {
//             year = '';
//         } else {
//             year = ',' + year;
//         }

//         var suffix = "th";
//         if (day % 10 == 1 && day != 11) {
//             suffix = 'st'
//         } else if (day % 10 == 2 && day != 12) {
//             suffix = 'nd'
//         } else if (day % 10 == 3 && day != 13) {
//             suffix = 'rd'
//         }
//         else {
//             suffix = 'th'
//         }

//         return (date + suffix + year + ' at' + time);
//     }
// }