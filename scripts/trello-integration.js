// Description:
//   Trello API Integration
//
// Commands:
//   `trello (last <num>) (all|unread|read) notifications`
//	 `trello (last <num>) (all|unread|read) mentions`
//	 `trello sumup (all|unread|read)` - Default: unread
//   `trello my cards` - get your assigned cards
// tested till here
// 	 `trello webhooks link <board/card url>` - post in channel to link it with trello model.
// 	 `trello webhooks unlink <board/card url>` - post in channel to unlink it with trello model.
//   `trello boards` - get Team's boards
//	 `trello disable|deactivate webhook <webhook-ID>` - temporarily deactivate it
//	 `trello enable|activate webhook <webhook-ID>` - activate it
//   `trello update webhooks callback url` - update all the webhooks callback url in case of changing hubot hosting. 
//	 `trello update|change webhook <webhook-ID> channel to <channel>`
//	 `trello delete webhook <webhook-ID>` - permanatly delete a webhook by its id.
//	 `trello show webhooks` - get information about current webhooks
//   `trello reply <comment_text>` - instantly replay to the last card mentioned.
// Configuration
//
// Author
//   andreash92

'use strict'

var slackmsg = require("./slackMsgs.js");
var request = require('request-promise');
var cache = require('./cache.js').getCache()
var c = require('./config.json')
var mongoskin = require('mongoskin');
var dateFormat = require('dateformat')
var Conversation = require('hubot-conversation');
var path = require('path')
var async = require('async')
var color = require('./colors.js')
const Promise = require("bluebird");

// config
var mongodb_uri = process.env.MONGODB_URL
var hubot_host_url = process.env.HUBOT_HOST_URL;
var trelloKey = process.env.HUBOT_TRELLO_KEY;
var trelloTeam = process.env.HUBOT_TRELLO_TEAM
var TRELLO_API = 'https://api.trello.com/1'
var trello_headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

if (!mongodb_uri || !hubot_host_url || !trelloKey || !trelloTeam) {
    return
}
module.exports = function (robot) {

    /*************************************************************************/
    /*                             Listeners                                 */
    /*************************************************************************/
    var switchBoard = new Conversation(robot);


    /* The follow 2 listeners are for possible features */

    // create card in a trello list.
    // usefull or not? 
    robot.respond(/trello list (.*) add card (.*)/i, function (res) {
    })

    // get the information of the board linked to channel.
    // in case we have linked boards/cards/lists to channels.
    /*
    robot.hear(/trello channel board/i, function (res) {
        var roomid = res.message.room
        var userid = res.message.user.id
        getChannelBoard(roomid).then(board => {
            console.log(board)
            // listChannelBoard(userid, roomid, board.id)
        }).catch(error => {
            console.log(error)
        })
    })
    */

    // unlink board/card/list from channel
    /*
    robot.hear(/trello unlink/i, function (res) {
        var roomid = res.message.room
        // var userid = res.message.user.id
        if (roomid[0] == 'D') { // D = Direct Message
            roomid = robot.brain.userForName(res.message.user.name).id
        }

        unlinkBoardFromChannel(roomid).then(unlinked => {
            if (unlinked) {
                res.reply('unlinked this channel from its Trello board. It can be re-linked with `trello link <board_url>`.')
            } else {
                res.send('This channel has not yet been linked to a Trello board.'
                    + '\nYou can link a board using trello link <board_url>`')
            }
        })
    })
    */

    // unlink board from channel
    /*
    robot.hear(/\btrello link (.*)trello.com\/b\/(.*)\b$/i, function (res) {
        var roomid = res.message.room
        var userid = res.message.user.id
        var modelUrl = 'b/' + res.match[2].trim()
        if (roomid[0] == 'D') { // D = Direct Message
            roomid = robot.brain.userForName(res.message.user.name).id
        }
        getModelInfo(userid, modelUrl)
            .then(board => {
                linkBoardChannel(roomid, board)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(c.errorsChannel, c.errorMessage
                    + `Script: ${path.basename(__filename)}`)
            })
    })
    */
    /**********************************************/


    robot.respond(/trello( last (\d+)|) (all |unread |read |)notifications?/i, function (res) {
        var userid = res.message.user.id
        var limit = res.match[2]
        var read_filter = res.match[3].trim()
        var query = { read_filter: read_filter }
        if (!read_filter) {
            query.read_filter = 'all'
        }
        if (limit) {
            query.limit = limit
        }
        getNotifications(userid, query).then((notifications) => {
            if (read_filter == 'all' || read_filter == 'unread') {
                if (!limit && notifications.length != 0) {
                    markNotificationsAsRead(userid)
                }
                else {
                    Promise.each(notifications, function (notif) {
                        markSingleNotificationAsRead(userid, notif.id)
                    })
                }
            }
        }).catch(e => { })
    })

    // dialogflow listener: not tested
    robot.on('showTrelloNotifications', function (data, res) {
        var userid = res.message.user.id
        var limit = data.parameters.limit
        var read_filter = data.parameters.read_filer
        var query = { read_filter: read_filter, filter: 'mentionedOnCard' }
        if (!read_filter) {
            query.read_filter = 'all'
        }
        if (limit) {
            query.limit = limit
        }
        getNotifications(res.message.user.id, query)
    })
    

    robot.respond(/trello( last (\d+)|) (all |unread |read |)mentions?/i, function (res) {
        var userid = res.message.user.id
        var limit = res.match[2]
        var read_filter = res.match[3].trim()
        var query = { read_filter: read_filter, filter: 'mentionedOnCard' }
        if (!read_filter) {
            query.read_filter = 'all'
        }
        if (limit) {
            query.limit = limit
        }
        getNotifications(res.message.user.id, query)
    })

    // dialogflow listener: not tested
    robot.on('showTrelloMentions', function (data, res) {
        var userid = res.message.user.id
        var limit = data.parameters.limit
        var read_filter = data.parameters.read_filer
        var query = { read_filter: read_filter, filter: 'mentionedOnCard' }
        if (!read_filter) {
            query.read_filter = 'all'
        }
        if (limit) {
            query.limit = limit
        }
        getNotifications(res.message.user.id, query)
    })

    robot.respond(/\btrello sum-?ups?( all| unread| read| since|)\b$/i, function (res) {
        var userid = res.message.user.id
        var read_filter = res.match[1].trim()
        if (!read_filter) {
            var query = { read_filter: 'unread' }
        }
        else if (read_filter == 'since') {
            var lastTrelloNotificationID = cache.get(userid, 'trello_last_notification')
            if (!lastTrelloNotificationID) {
                query = { read_filer: 'unread' }
            } else {
                query = { since: lastTrelloNotificationID }
            }
        }
        else {
            query = { read_filter: read_filter }
        }
        getNotificationsSumUp(userid, query)
    })

    // todo: not tested
    robot.on('showTrelloSumups', function (data, res) {
        res.message.user.id
        getNotificationsSumUp(userid, {})
    })


    robot.respond(/trello my cards/i, function (res) {
        trelloMyCardsListener(res)
    })

    robot.on('showTrelloCards', function ({ }, res) {
        trelloMyCardsListener(res)
    })

    function trelloMyCardsListener(res) {
        var userid = res.message.user.id
        updateTrelloResources(userid).then(() => {
            listUserCards(userid)
        }).catch(error => {
            /* When catch occures means that the user is not logged in 
             * but this is handled by the getCredentials() function, 
             * so there is nothing to care about here 
             */
        })
    }


    robot.on('trelloSumUp', function (userid, query, saveLastNotif) {
        getNotificationsSumUp(userid, query, saveLastNotif)
    })


    robot.hear(/trello webhooks? link (.*)trello.com\/(.*)/i, function (res) {
        var room = slackmsg.getChannelName(robot, res)
        var userid = res.message.user.id
        var modelUrl = res.match[2].trim()
        if (room == 'DM') { // DM = Direct Message
            room = '@' + res.message.user.name
        }
        getModelInfo(userid, modelUrl)
            .then(model => {
                createWebhook(userid, model, room)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(c.errorsChannel, c.errorMessage
                    + `Script: ${path.basename(__filename)}`)
            })
    })


    robot.hear(/trello webhooks? unlink (.*)trello.com\/(.*)/i, function (res) {
        var room = slackmsg.getChannelName(robot, res)
        var userid = res.message.user.id
        var modelShortLink = res.match[2].trim().split('/')[1]
        if (room == 'DM') {
            room = '@' + res.message.user.name
        }
        var queryObj = {
            userid: userid,
            modelShortLink: modelShortLink,
            room: room
        }
        getWebhookId(queryObj)
            .then(webhooksIds => {
                Promise.each(webhooksIds, function (webhookId) {
                    deleteWebhook(res.message.user.id, webhookId)
                })
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(c.errorsChannel, c.errorMessage
                    + `Script: ${path.basename(__filename)}`)
            })
    })

    robot.respond(/trello boards/i, function (res) {
        var userid = res.message.user.id
        listTeamBoards(userid)
    })

    robot.on('showTrelloBoards', function ({ }, res) {
        var userid = res.message.user.id
        listTeamBoards(userid)
    })

    // FOR DEBUGGING ONLY
    // robot.respond(/trello res/, res => {
    //     updateTrelloResources(res.message.user.id).then(r => console.log())
    // })


    robot.respond(/trello (disable|pause|stop|deactivate) webhook (.*)/i, function (res) {
        var webhookId = res.match[2].trim()
        updateWebhook(res.message.user.id, webhookId, { active: false })
    })

    robot.respond(/trello (enable|resume|start|activate) webhook (.*)/i, function (res) {
        var webhookId = res.match[2].trim()
        updateWebhook(res.message.user.id, webhookId, { active: true })
    })

    // The follow command is useful when changing hubot host (i.e. when testing with ngrok).
    // Due to that, it's not available through dialogflow  
    robot.respond(/trello update webhooks callback url/i, function (res) {
        // var webhookId = res.match[1].trim()
        var userid = res.message.user.id
        robot.messageRoom(userid, 'Processing..')
        robot.messageRoom(userid, 'Note that webhooks not created by you can\'t be updated.')
        updateWebhooksCallbackURL(userid)

    })

    robot.respond(/trello (change|edit|replace|update) webhook (.*) channel to (.*)/i, function (res) {
        var webhookId = res.match[2].trim()
        var channel = res.match[3].trim()
        updateWebhook(res.message.user.id, webhookId, { callbackURL: `${hubot_host_url}/hubot/trello-webhooks?room=${channel}` })
    })

    robot.respond(/trello delete webhook (.*)/i, function (res) {
        var webhookId = res.match[1].trim()
        deleteWebhook(res.message.user.id, webhookId)
    })

    robot.on()

    // get the existing trello webhooks and display them
    robot.respond(/trello show webhooks/i, function (res) {
        var userid = res.message.user.id
        getWebhooks(res.message.user.id)
    })
    robot.on('showTrelloWebhooks', function (response, res) {
        var userid = res.message.user.id
        getWebhooks(res.message.user.id)
    })


    robot.on('postTrelloAction', function (modelid, room, actionId) {
        // first i need to get the token of the user who created that webhook.
        Promise.each(cache.get('trelloWebhooks'), function (webhook) {
            if (webhook.room == room && webhook.model_id == modelid) {
                var userid = webhook.userid // this is the id of the user who created the webhook    
                var token = cache.get(userid).trello_token

                getTrelloAction(token, actionId, room)
            }
        }).catch(error => {
            //TODO
        })
    })

    robot.on('trelloBoardRename', function (modelId, modelName) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        db.bind('trelloWebhooks').updateAsync(
            { idModel: modelId },
            {
                $set: { modelName: modelName }
            },
            { multi: true },
            { upsert: true })
            .catch(error => {
                robot.logger.error(error)
                if (c.errorsChannel) {
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
                }
            })

    })

    // reply instantly to the last trello card comment mention
    robot.respond(/trello reply (.*)/i, function (res) {
        var userid = res.message.user.id
        var commentText = res.match[1]
        try {
            var cardId = cache.get(userid).trello_last_mentioned_card_id
            if (cardId) {
                addCardComment(userid, cardId, commentText)
            } else {
                throw null
            }
        } catch (error) {
            robot.messageRoom(userid, 'Sorry but no card found.')
        }
    })

    /*************************************************************************/
    /*                             API Calls                                 */
    /*************************************************************************/


    /* The follow 5 functions are for POSSIBLE features.
     * Feature:  linkins channels to boards/lists/cards */
    function getChannelBoard(roomId) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        return db.bind('channelsToTrelloBoards').findOneAsync(
            {}, { _id: roomId, board: 1 }).then((result) => {
                return result
            })
    }

    function getChannelCard(roomid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        return db.bind('channelsToTrelloBoards').findOneAsync(
            {}, { _id: roomId, card: 1 }).then((result) => {
                return result
            })
    }

    function getChannelList(roomid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        return db.bind('channelsToTrelloBoards').findOneAsync(
            {}, { _id: roomId, list: 1 }).then((result) => {
                return result
            })
    }

    function linkBoardChannel(roomid, board) {
        var query = { _id: roomid }
        var doc = { $set: { _id: roomid, board } }
        dbFindAndModify('channelsToTrelloBoards', query, [['_id', 1]], doc, { upsert: true })
            .then(() => {
                cache.set(`channelsToBoards.${roomid}`, board)
                // var handled = robot.emit('setCache', { _id: roomid, board }) // emits an event for brain.js
                // if (!handled) {
                //     robot.logger.warning('No script handled the setCache event.')
                // }
            })
    }

    function unlinkBoardFromChannel(roomid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        return db.bind('channelsToTrelloBoards').removeAsync({ _id: roomid })
            .then((response) => {
                db.close()
                return response.result.n
            })
    }

    /*****************/

    function listUserCards(userid) {
        var memberId = getMemberId(userid)
        if (!memberId) return 0

        var db = mongoskin.MongoClient.connect(mongodb_uri);
        db.bind('trelloBoards').aggregateAsync(
            { '$unwind': '$lists' },
            { '$unwind': '$lists.cards' },
            { '$match': { 'lists.cards.idMembers': memberId } }
        ).then(boards => {
            var fs = require('fs')
            var msg = { attachments: [] }
            return Promise.each(boards, function (board) {
                var attachment = slackmsg.attachment()
                attachment.author_name = 'Card'
                attachment.author_icon = hubot_host_url + '/icons/trelloCard'

                attachment.title = `<${board.lists.cards.shortUrl}|${board.lists.cards.name}>`
                var listName = board.lists.name
                attachment.text = `In list ${bold(listName)} on <${board.url}|${board.name}>\n`
                attachment.color = color.getHex(board.prefs.background)

                var badges = board.lists.cards.badges

                if (badges.due) {
                    var due = new Date(badges.due)
                    var df = 'dd mmm yy'
                    if (due.getFullYear == new Date().getFullYear) {
                        df = 'mmm dd' // no need to display the year
                    }
                    // Hours must be in 12H Format
                    // Minutes must be 00 or 30 
                    var hours = due.getHours() > 12 ? due.getHours() - 12 : due.getHours();
                    var clock = hours + '' + (due.getMinutes() + (30 - due.getMinutes()))
                    attachment.text += `:clock${clock}: ${dateFormat(due, df)} `
                }

                if (badges.comments) {
                    attachment.text += `:speech_balloon: ${badges.comments} `
                }

                if (badges.attachments) {
                    attachment.text += `:paperclip: ${badges.attachments} `
                }

                if (badges.checkItems) {
                    var checkBox = ':ballot_box_with_check:'
                    if (badges.checkItems == badges.checkItemsChecked) {
                        checkBox = ':white_check_mark:'
                    }
                    attachment.text += `${checkBox} ${badges.checkItemsChecked}/${badges.checkItems} `
                }

                if (badges.attachments) {
                    attachment.text += `:paperclip: ${badges.attachments} `
                }

                if (board.lists.cards.idMembers.length) {
                    attachment.text += `:bust_in_silhouette: ${board.lists.cards.idMembers.length} `
                }

                var labels = board.lists.cards.labels
                if (labels.length) {
                    var labelsString = ''
                    for (var i = 0; i < labels.length; i++) {

                        if (labels[i].name) {
                            labelsString += labels[i].name + ', '
                        }
                        else {
                            labelsString += labels[i].color + ', '
                        }
                    }
                    attachment.text += "\nLabels: " + labelsString.slice(0, -2)

                }

                attachment.text += '\n' + board.lists.cards.desc

                attachment.footer = 'Last Activiy'
                attachment.ts = Date.parse(board.lists.cards.dateLastActivity) / 1000

                msg.attachments.push(attachment)
            }).then(() => {
                // return msg
                robot.messageRoom(userid, msg)
            })
        })
    }


    function markNotificationsAsRead(userid) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var options = {
            url: `${TRELLO_API}/notifications/all/read?${credentials}`,
            method: 'POST',
            headers: trello_headers,
            json: true
        }

        request(options).then(() => {
            robot.messageRoom(userid, 'Trello notifications marked as read.')
        })
    }

    function markSingleNotificationAsRead(userid, notificationId) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var options = {
            url: `${TRELLO_API}/notifications/${notificationId}?${credentials}`,
            method: 'PUT',
            headers: trello_headers,
            qs: { unread: false },
            json: true
        }

        request(options).then(() => {
            robot.messageRoom(userid, 'Trello notifications marked as read.')
        })
    }

    /* This function was inplemented due to that trello api did not provide any api call 
     * that returns all the info of the board. ID's, names etc
     */
    function updateTrelloResources(userid) {
        var credentials = getCredentials(userid)
        if (!credentials) {
            return new Promise(function (resolve, reject) {
                return reject('not logged in')
            })
        }

        var query = {
            filter: 'all',
            fields: 'all'
        }

        var options = {
            url: `${TRELLO_API}/organizations/${trelloTeam}/boards?${credentials}`,
            method: 'GET',
            qs: query,
            headers: trello_headers,
            json: true
        }


        return request(options).then(teamBoards => {
            return Promise.each(teamBoards, function (board) {
                var options = {
                    method: 'GET',
                    url: `https://api.trello.com/1/boards/${board.id}/lists?${credentials}`,
                    qs:
                    {
                        lists: 'all',
                        fields: 'all',
                        cards: 'all',
                        card_fields: 'all',
                        card_members: true,
                        card_member_fields: 'all'
                        /* card_members is a nested card resource but for some reason it doen't work. 
                         * Based on trello api documentation it should return the 
                         * members resources assigned on each card.
                         * It might be usefull in the future. (e.g. Display assigned members on cards)
                         * More info: https://developers.trello.com/reference#cards-nested-resource
                         */
                    },
                    headers: trello_headers,
                    json: true
                }
                return request(options).then(lists => {
                    board.lists = lists

                    var query = { _id: board.id }
                    var doc = { $set: board }
                    var options = { upsert: true }
                    return dbFindAndModify('trelloBoards', query, [['_id', 1]], doc, options)
                })
            })
        })
    }

    function listTeamBoards(userid, filter = 'open') {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var query = { filter: filter, fields: 'all' }

        var options = {
            url: `${TRELLO_API}/organizations/${trelloTeam}/boards?${credentials}`,
            method: 'GET',
            qs: query,
            headers: trello_headers,
            json: true
        }

        request(options).then(boardsArray => {
            displayBoards(userid, boardsArray)
        })
    }

    function displayBoards(roomid, boardsArray) {
        var msg = { attachments: [] }
        Promise.each(boardsArray, function (board) {
            var attachment = slackmsg.attachment()
            var boardName = board.name
            var boardDesc = board.desc
            var boardURL = board.shortUrl
            var boardColor = board.prefs.background
            var boardLastActivity = board.dateLastActivity
            attachment.author_name = 'Board'
            // TODO attachment.author_icon = 
            attachment.title = `<${boardURL}|${boardName}>`
            attachment.text = `${boardDesc}`
            attachment.color = color.getHex(boardColor)
            attachment.footer = 'Last activity'
            attachment.ts = Date.parse(boardLastActivity) / 1000
            msg.attachments.push(attachment)
        }).done(() => {
            robot.messageRoom(roomid, msg)
        })
    }

    function addCardComment(userid, cardId, commentText) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var query = { text: commentText }

        var options = {
            url: `${TRELLO_API}/cards/${cardId}/actions/comments?${credentials}`,
            method: 'POST',
            qs: query,
            headers: trello_headers,
            json: true
        }

        request(options)
            .then(res => {
                var cardName = res.data.card.name
                var cardUrl = `https://trello.com/c/${res.data.card.shortLink}`
                robot.messageRoom(userid, `Comment on card <${cardUrl}|${cardName}> added.`)
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(userid, error.message)
            })
    }

    function updateWebhook(userid, webhookId, query) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var options = {
            url: `${TRELLO_API}/webhooks/${webhookId}?${credentials}`,
            method: 'PUT',
            qs: query,
            headers: trello_headers,
            json: true
        }

        if (query.callbackURL) {
            var room = query.callbackURL.split('room=')[1]
            var dbSet = { room: room }
        } else {
            var dbSet = query
        }

        request(options)
            .then(webhook => {
                //save to db and cache 
                var db = mongoskin.MongoClient.connect(mongodb_uri);
                db.bind('trelloWebhooks').findAndModifyAsync(
                    { _id: webhook.id },
                    [["_id", 1]],
                    {
                        $set: dbSet
                    },
                    { upsert: false })
                    .catch(err => {
                        robot.logger.error(err)
                        if (c.errorsChannel) {
                            robot.messageRoom(c.errorsChannel, c.errorMessage
                                + `Script: ${path.basename(__filename)}`)
                        }
                    })
            })
            .then(() => {
                var handled = robot.emit('resetCacheForTrelloWebhooks') // emits an event for brain.js
                if (!handled) {
                    robot.logger.warning('No script handled the resetCacheForTrelloWebhooks event.')
                }
                if (query.active) {
                    robot.messageRoom(userid, 'Webhook activated. You can deactivate it again: `deactivate trello webhook <Webhook ID>`')
                } else if (query.active == false) {
                    robot.messageRoom(userid, 'Webhook deactivated. You can activate it again: `activate trello webhook <Webhook ID>`')
                } else if (query.callbackURL) {
                    robot.messageRoom(userid, 'Webhook ' + webhookId + ' successfully updated')
                }
            })
            .catch(error => {
                // TODO 
                // would be better to prin the error.message or error.error
                if (error.statusCode == 400) {
                    robot.logger.info(error)
                    robot.messageRoom(userid, error.message)
                    robot.messageRoom(userid, 'You provided a wrong webhook ID. Say `show trello webhooks` to see webhooks details.')
                }
                else if (error.statusCode == 401) {
                    robot.logger.error(error.message)
                    robot.messageRoom(userid, error.message)
                    robot.messageRoom(userid, 'Only the user who created the webhook is eligible to make any changes. Say `show trello webhooks` to see webhooks details.')
                } else {
                    robot.messageRoom(userid, error.message)
                }
            })
    }

    function getWebhookId(queryObj) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return new Promise(function (resolve, reject) {
            db.bind('trelloWebhooks').find(queryObj).toArrayAsync()
                .then(webhooks => {
                    var idsArray = []
                    Promise.each(webhooks, function (webhook) {
                        idsArray.push(webhook._id)
                    }).then(() => {
                        resolve(idsArray)
                    })
                })
                .catch(error => {
                    reject(error)
                })
        })
    }

    function deleteWebhook(userid, webhookId) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var options = {
            url: `${TRELLO_API}/webhooks/${webhookId}?${credentials}`,
            method: 'DELETE',
            headers: trello_headers,
            json: true
        }

        var db = mongoskin.MongoClient.connect(mongodb_uri);
        request(options)
            .then(webhook => {
                // update db 
                db.bind('trelloWebhooks').removeAsync({ _id: webhookId })
            })
            .then(() => {
                // then update cache (cache 'looks' at db so update it later than db)
                var handled = robot.emit('resetCacheForTrelloWebhooks')
                if (!handled) {
                    robot.logger.warning('No script handled the resetCacheForTrelloWebhooks event.')
                }
                robot.messageRoom(userid, 'Webhook deleted permanently.')
            })
            .catch(error => {
                if (error.statusCode == 400) {
                    robot.messageRoom(userid, 'You provided a wrong webhook ID. Say `show trello webhooks` to see webhooks details.')
                }
                else if (error.statusCode == 401) {
                    robot.messageRoom(userid, 'Only the user who created the webhook is eligible to disable it. Say `show trello webhooks` to see webhooks details.')
                }
                else {
                    robot.messageRoom(userid, error.error)
                }
            })
            .done(() => {
                db.close()
            })

    }

    function updateWebhooksCallbackURL(userid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        db.bind('trelloWebhooks').find().toArrayAsync()
            .then(webhooks => {
                Promise.each(webhooks, function (webhook) {
                    var callbackURL = `${hubot_host_url}/hubot/trello-webhooks?room=${webhook.room}`
                    updateWebhook(webhook.userid, webhook._id, { callbackURL: callbackURL })
                })
            })
            .catch(error => {
                robot.logger.error(error)
                robot.messageRoom(res.message.user.id, c.errorMessage)
            })
            .done(() => {
                db.close()
            })
    }

    function getTrelloAction(token, actionId, room) {

        var qs = { entities: true }

        var options = {
            url: `${TRELLO_API}/actions/${actionId}?token=${token}&key=${trelloKey}`,
            method: 'GET',
            qs: qs,
            headers: trello_headers,
            json: true
        }

        request(options)
            .then(action => {
                displayNotifications(room, [action])

                // Add here any logic for user mentions.
                /* Problem is that:
                 * action.type == 'mentionedOnCard' does not exist. nor webhook.type
                 * but only notification.type which is not included in webhooks but only
                 * after requesting it. 
                 * 
                 * Possible walkthrough 1: 
                 *   each time action.type == 'commentCard'
                 *   request from every user the notifications 
                 *   and check for mentionOnCard notification. 
                 *
                 * Possible walkthrough 2: 
                 * (currently working with this one - seems more logic)
                 *   each time action.type == 'commentCard'
                 *   check for any regex word match that starts with '@'
                 *   check if the user exists and get the slack user id.
                 *   After that, inform the user for its mention on card.
                 *   Problem: In case of trello username changes we can't 
                 *      find the user mentioned.
                 *   Solution 1: Everytime we don't have a match update usernames. 
                 *   Solution 2: Everytime a mention is made, update usernames first. 
                 *   Solution 3: Update them every hour or half hour  
                 */

                if (action.type == 'commentCard') {
                    var commentText = action.data.text
                    var regex = /(?:^|\W)@(\w+)(?!\w)/g, match, matches = [];
                    while (match = regex.exec(commentText)) {
                        var matchedUser = match[1]
                        var user = getSlackUser(matchedUser)

                        /* when bot can't match a trello username with a slack username 
                         * then it updates all the trello usernames and tries again once more.
                         * If bot can't find it again, then the trello user probably does not belong 
                         * in slack team or it's just not logged in through bot's trello route yet. 
                         */
                        if (!user) {
                            updateAllTrelloUsernames().then(() => {
                                var user = getSlackUser(matchedUser)
                                if (user)
                                    informUserMention(user.id, action)
                            })
                        }
                        else {
                            informUserMention(user.id, action)
                        }
                    }
                }
            })
            .catch(error => {
                //TODO
            })
    }

    function informUserMention(userid, action) {
        var cardId = action.data.card.id
        cache.set(userid, { trello_last_mentioned_card_id: cardId })
        robot.messageRoom(userid, 'You are mentioned on trello.')
        displayNotifications(userid, [action])
        robot.messageRoom(userid, '`trello reply <text>` to reply to your last card mentioned')
    }
    function updateAllTrelloUsernames() {
        var userIDs = cache.get('userIDs')

        return new Promise((resolve, reject) => {
            Promise.each(userIDs, function (userid) {
                updateUsername(userid).then(() => {
                    return resolve()
                })
            })
        })
    }
    function updateUsername(userid) {
        return new Promise((resolve, reject) => {

            var credentials = getCredentials(userid)
            if (!credentials) { return 0 }

            var options = {
                url: `${TRELLO_API}/members/me/username?${credentials}`,
                method: 'GET',
                headers: trello_headers,
                json: true
            }

            request(options)
                .then(data => {
                    var newUsername = data._value
                    cache.set(userid, { trello_username: newUsername })
                    var db = mongoskin.MongoClient.connect(mongodb_uri);
                    db.bind('users').updateAsync(
                        { _id: userid },
                        {
                            $set: { trello_username: newUsername }
                        },
                        { upsert: true })
                        .catch(error => {
                            robot.logger.error(error)
                        })
                })
                .then(() => {
                    resolve()
                })
                .catch(error => {
                    robot.logger.error(error)
                })
        })
    }

    function getWebhooks(userid) {
        var db = mongoskin.MongoClient.connect(mongodb_uri);
        db.bind('trelloWebhooks').find().toArrayAsync()
            .then(webhooks => {
                var msg = { attachments: [] }
                Promise.each(webhooks, function (webhook) {
                    var attachment = slackmsg.attachment()
                    if (webhook.active) {
                        var active = 'Yes'
                        attachment.color = 'good'
                    }
                    else {
                        var active = 'No'
                        attachment.color = 'danger'
                    }

                    attachment.pretext = `Created by ${webhook.username} for the ${webhook.modelType} `
                        + `<${webhook.modelShortUrl}|${webhook.modelName}>`
                    attachment.fields.push({
                        title: "Channel",
                        value: webhook.room,
                        short: true
                    })
                    attachment.fields.push({
                        title: "Active",
                        value: active,
                        short: true
                    })
                    attachment.fields.push({
                        title: "ID",
                        value: webhook._id,
                        short: true
                    })

                    msg.attachments.push(attachment)
                    return msg
                }).then(() => {
                    if (webhooks.length) {
                        robot.messageRoom(userid, msg)
                    } else {
                        robot.messageRoom(userid, 'There aren`t any webhooks. Say `help trello webhooks` to see the available commands for creating a webhook.')
                    }
                })

            })
            .catch(err => {
                robot.logger.error(err)
                if (c.errorsChannel) {
                    robot.messageRoom(c.errorsChannel, c.errorMessage
                        + `Script: ${path.basename(__filename)}`)
                }
            })

    }

    function createWebhook(userid, model, room) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var username = robot.brain.userForId(userid).name

        var qs = {
            description: `Created by ${username} for the ${model.type} "${model.name}"`,
            callbackURL: `${hubot_host_url}/hubot/trello-webhooks?room=${room}`,
            idModel: model.id
        }

        var options = {
            url: `${TRELLO_API}/webhooks?${credentials}`,
            method: 'POST',
            qs: qs,
            headers: trello_headers,
            json: true
        }

        request(options)
            .then(webhook => {
                //save to db and cache
                var webhookObj = {
                    userid: userid,
                    username: username,
                    idModel: webhook.idModel,
                    modelName: model.name,
                    modelType: model.type,
                    modelShortUrl: model.shortUrl,
                    modelShortLink: model.shortLink,
                    room: room,
                    active: webhook.active,
                    description: webhook.description
                }

                var db = mongoskin.MongoClient.connect(mongodb_uri);
                db.bind('trelloWebhooks').findAndModifyAsync(
                    { _id: webhook.id },
                    [["_id", 1]],
                    {
                        $set: webhookObj
                    },
                    { upsert: true })
                    .catch(error => {
                        robot.logger.error(error)
                        if (c.errorsChannel) {
                            robot.messageRoom(c.errorsChannel, c.errorMessage
                                + `Script: ${path.basename(__filename)}`)
                        }
                    })
            })
            .then(() => {
                // then update cache (cache is a db 'mirror' so we need to update it after db update)
                var handled = robot.emit('resetCacheForTrelloWebhooks')
                if (!handled) {
                    robot.logger.warning('No script handled the resetCacheForTrelloWebhooks event.')
                }
                robot.messageRoom(room, ' To check your team`s webhooks: `show trello webhooks`')
                robot.messageRoom(userid, 'Webbhook created! To check your team`s webhooks: `show trello webhooks`')
            })
            .catch(error => {
                robot.messageRoom(userid, error.error)
            })

    }

    // modelUrl must be www.trello.com/<modelUrl>
    function getModelInfo(userid, modelUrl) {
        var credentials = getCredentials(userid)
        if (!credentials) {
            return new Promise(function (resolve, reject) {
                reject(401)
            })
        }
        var typeLetter = modelUrl.split('/')[0]
        var id = modelUrl.split('/')[1]
        var modelType
        if (typeLetter == 'b') {
            modelType = 'boards'
        }
        else if (typeLetter == 'c') {
            modelType = 'cards'
        }

        var query = { fields: 'id,name,shortLink,shortUrl' }
        var options = {
            url: `${TRELLO_API}/${modelType}/${id}?${credentials}`,
            method: 'GET',
            qs: query,
            headers: trello_headers,
            json: true
        }
        return new Promise(function (resolve, reject) {
            request(options)
                .then(model => {
                    resolve({
                        id: model.id,
                        name: model.name,
                        shortLink: model.shortLink,
                        shortUrl: model.shortUrl,
                        type: modelType.slice(0, -1)
                    })
                })
                .catch(error => {
                    reject(error)
                })
        })
    }

    function getNotifications(userid, query) {
        var credentials = getCredentials(userid)
        if (!credentials) {
            return new Promise(function (resolve, reject) {
                reject('not logged in')
            })
        }

        var qs = Object.assign(
            { entities: true },
            query
        )
        var options = {
            url: `${TRELLO_API}/members/me/notifications?${credentials}`,
            method: 'GET',
            qs: qs,
            headers: trello_headers,
            json: true
        }

        return request(options)
            .then(notifications => {
                if (!notifications.length) {
                    robot.messageRoom(userid, 'Nothing found!')
                    return notifications
                } else {
                    displayNotifications(userid, notifications)
                    return notifications
                }
            })
            .catch(error => {
                return robot.logger.error(error.message)
            })
    }

    function getNotificationsSumUp(userid, query, saveLastNotificationID = false) {
        var credentials = getCredentials(userid)
        if (!credentials) { return 0 }

        var options = {
            url: `${TRELLO_API}/members/me/notifications?${credentials}`,
            method: 'GET',
            qs: query,
            headers: trello_headers,
            json: true
        }

        request(options)
            .then(notifications => {
                if (!notifications.length) {
                    robot.messageRoom(userid, 'Nothing found!')
                } else {
                    displaySumUp(userid, notifications)

                    if (saveLastNotificationID) {
                        //TODO save last notification id
                        var lastTrelloNotificationID = notifications[0].id

                        cache.set(userid, { trello_last_notification: lastTrelloNotificationID })

                        var db = mongoskin.MongoClient.connect(mongodb_uri);
                        db.bind('users').findAndModifyAsync(
                            { _id: userid },
                            [["_id", 1]],
                            { $set: { trello_last_notification: lastTrelloNotificationID } },
                            { upsert: true })
                            .catch(err => {
                                robot.logger.error(err)
                                if (c.errorsChannel) {
                                    robot.messageRoom(c.errorsChannel, c.errorMessage
                                        + `Script: ${path.basename(__filename)}`)
                                }
                            })
                    }
                }
            })
            .catch(error => {
                //TODO handle error codes: i.e. 404 not found -> dont post
                errorHandler(userid, error)
            })
    }

    function displaySumUp(userid, notifications) {
        var typesCnt = {}
        var i, j
        for (i = 0; i < notifications.length; i++) {
            var notifType = notifications[i].type
            if (!typesCnt[notifType]) {
                typesCnt[notifType] = 1
            } else {
                typesCnt[notifType] += 1
            }
        }

        var msg = {
            text: 'Here is your Trello Notifications Sum-Up:',
            attachments: []
        }
        var types = Object.keys(typesCnt)
        var s, have, were
        for (j = 0; j < types.length; j++) {
            var attachment = slackmsg.attachment()
            if (typesCnt[types[j]] > 1) {
                s = 's'
                have = 'have'
                were = 'were'
            } else {
                have = 'has'
                were = 'was'
                s = ''
            }
            switch (types[j]) {
                case 'addAdminToBoard':
                    break
                case 'addAdminToOrganization':
                    attachment.text = `You've been made ${bold('admin')} in ${typesCnt[types[j]]} ${bold('organization')}${s}`
                    msg.attachments.push(attachment)
                    break
                case 'addAttachmentToCard':
                    attachment.color = 'good'
                    attachment.text = `${typesCnt[types[j]]} ${bold('attachement' + s)} ${have} been added to your subscribed card${s} `
                    msg.attachments.push(attachment)
                    break
                case 'addedMemberToCard':
                    msg.attachments.push({ text: `${types[j]} ${typesCnt[types[j]]}` })
                    break
                case 'addedToBoard':
                    attachment.color = 'danger'
                    attachment.text = `You've been ${bold('added')} to ${typesCnt[types[j]]} ${bold('board' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'addedToCard':
                    attachment.color = 'danger'
                    attachment.text = `You've been ${bold('added')} to ${typesCnt[types[j]]} ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'addedToOrganization':
                    attachment.color = 'good'
                    attachment.text = `You've been ${bold('added')} to ${typesCnt[types[j]]} ${bold('board' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'cardDueSoon':
                    attachment.color = 'danger'
                    attachment.text = `The ${bold('due date')} of ${typesCnt[types[j]]} card${s} has ${bold('passed')}`
                    msg.attachments.push(attachment)
                    break
                case 'changeCard':
                    attachment.color = 'warning'
                    attachment.text = `There ${were} ${typesCnt[types[j]]} ${bold('change' + s)} to subscribed ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'closeBoard':
                    attachment.text = `${typesCnt[types[j]]} ${bold('board' + s)} ${have} been ${bold('closed')}`
                    msg.attachments.push(attachment)
                    break
                case 'commentCard':
                    attachment.color = 'warning'

                    attachment.text = `There ${were} ${typesCnt[types[j]]} ${bold('comment' + s)} to your subscribed ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'createdCard':
                    // attachment.text = `${types[j]} ${typesCnt[types[j]]}`
                    // msg.attachments.push(attachment)
                    break
                case 'invitedToBoard':
                    attachment.text = `You've been ${bold('invited')} to ${typesCnt[types[j]]}${bold('board' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'invitedToOrganization':
                    attachment.text = `You've been ${bold('invited')} to ${typesCnt[types[j]]} ${bold('organization' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'makeAdminOfBoard':
                    attachment.text = `You've been made ${bold('admin')} in ${typesCnt[types[j]]} ${bold('board' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'makeAdminOfOrganization':
                    attachment.text = `You've been made ${bold('admin')} in ${typesCnt[types[j]]} ${bold('organization' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'mentionedOnCard':
                    attachment.color = 'warning'
                    attachment.text = `You've been ${bold('mentioned')} on ${typesCnt[types[j]]} ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'removedFromBoard':
                    attachment.color = 'danger'
                    attachment.text = `You've been ${bold('removed')} from ${typesCnt[types[j]]} ${bold('board' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'removedFromCard':
                    attachment.color = 'danger'

                    attachment.text = `You've been ${bold('removed')} from ${typesCnt[types[j]]} ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'removedFromOrganization':
                    attachment.color = 'danger'
                    attachment.text = `You've been ${bold('removed')} from ${typesCnt[types[j]]} ${bold('organization' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'removedMemberFromCard':
                    attachment.color = 'warning'
                    attachment.text = `There ${were} ${typesCnt[types[j]]} member ${bold('deletion' + s)} from ${bold('card' + s)}`
                    msg.attachments.push(attachment)
                    break
                case 'declinedInvitationToBoard':
                case 'declinedInvitationToOrganization':
                case 'unconfirmedInvitedToBoard':
                case 'unconfirmedInvitedToOrganization':
                case 'memberJoinedTrello':
                    break
                case 'updateCheckItemStateOnCard':
                    attachment.text = `${types[j]} ${typesCnt[types[j]]}`
                    msg.attachments.push(attachment)
                    break
            }
        }
        robot.messageRoom(userid, msg)
    }

    function displayNotifications(userid, notifications) {
        var msg = { attachments: [] }

        for (var i = 0; i < notifications.length; i++) {
            var entities = notifications[i].entities
            var pretext = ''
            var text = ''
            for (var j = 0; j < entities.length; j++) {
                var entity = entities[j]
                switch (entity.type) {
                    case 'text':
                        pretext += entity.text + ' '
                        break
                    case 'member':
                        pretext += `<https://trello.com/${entity.username}|${entity.text}> (${entity.username})` + ' '
                        break
                    case 'card':
                        pretext += `<https://trello.com/c/${entity.shortLink}|${entity.text}>` + ' '
                        if (entity.desc) {
                            text = entity.text
                        }
                        break
                    case 'list':
                        pretext += `"${entity.text}"` + ' '
                        break
                    case 'board':
                        pretext += `<https://trello.com/b/${entity.shortLink}|${entity.text}>` + ' '
                        break
                    case 'comment':
                        text = entity.text
                        break
                    case 'checkItem':
                        pretext += entity.text + ' '
                        break
                    case 'date':
                        pretext += dateFormat(new Date(entity.date), 'mmm dS yyyy, HH:MM TT ')
                        break
                    case 'label':
                        if (entity.text) {
                            pretext += entity.text + ' '
                        } else {
                            pretext += entity.color + ' '
                        }
                        break
                    case 'relDate':
                        pretext += entity.current + ' '
                        break
                    case 'attachment':
                        // if link==true
                        pretext += `<${entity.url}|${entity.text}>` + ' '
                        break
                    case 'attachmentPreview':
                        // pretext += `<${entity.url}|${entity.text}>` + ' '
                        break
                    default:
                        // TODO
                        break
                }
            }
            msg.attachments.push({
                fallback: pretext,
                pretext: pretext,
                text: text
            })
        }
        if (entities.length != 1) {         // This is because of a trello bug (?) 
            robot.messageRoom(userid, msg)  // when notification.type = 'deleteComment' the json includes just one member entity only
        }
    }


    /*************************************************************************/
    /*                          helpful functions                            */
    /*************************************************************************/


    function getCredentials(userid) {

        try {
            var token = cache.get(userid).trello_token
            var username = cache.get(userid).trello_username

            if (!token || !username) { // catch the case where username or token are null/undefined
                throw error
            }
        } catch (error) {
            robot.messageRoom(userid, 'Hey, it seems your account is not autheticated to Trello.')
            robot.emit('trelloOAuthLogin', userid)
            return false
        }
        return `token=${token}&key=${trelloKey}`

    }

    function getMemberId(userid) {

        try {
            var memberId = cache.get(userid).trello_member_id
            if (!memberId) { // catch the case where username or token are null/undefined
                throw error
            }
        } catch (error) {
            robot.emit('trelloOAuthLogin', userid)
            return false
        }
        return memberId

    }



    // TODO change the messages
    function errorHandler(userid, error) {
        if (error.statusCode == 401) {
            robot.messageRoom(userid, error.message)
        } else if (error.statusCode == 404) {
            robot.messageRoom(userid, error.message)
        } else {
            robot.messageRoom(userid, c.errorMessage + 'Status Code: ' + error.statusCode)
            robot.logger.error(error)
        }
    }

    function bold(text) {
        if (robot.adapterName == 'slack') {
            return `*${text}*`
        }
        else if (robot.adapterName == 'mattermost') {
            return `**${text}**`
        }
        // Add any other adapters here  
        else {
            return text
        }
    }

    function getSlackUser(trelloUsername) {

        var userids = cache.get('userIDs')

        for (var i = 0; i < userids.length; i++) {
            var id = userids[i]

            var user = cache.get(id)
            var cachedTrelloUsername
            try {
                var cachedTrelloUsername = user.trello_username
                if (cachedTrelloUsername == trelloUsername) {
                    return robot.brain.userForId(id)
                }
            } catch (e) {
                robot.logger.error(`script: ${path.basename(__filename)} in getSlackUser() ` + e)
            }
        }
        return false
    }

    function dbFindAndModify(collection, query, sort, doc, options) {
        return new Promise((resolve, reject) => {
            var db = mongoskin.MongoClient.connect(mongodb_uri);
            db.bind(collection).findAndModifyAsync(query, sort, doc, options).then(res => {
                resolve(res)
            }).catch(error => {
                reject(error)
            })
        })
    }
    /*******************************************************************/
    /*          Slack Buttons Implementation - TEMPLATE                */
    /*               (not in use - for future use)                     */
    /*******************************************************************/

    /*
    function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
        var postOptions = {
            uri: responseURL,
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            },
            json: JSONmessage
        };
        request(postOptions, (error, response, body) => {
            if (error) {
                // handle errors as you see fit
            };
        })
    }

    // trello board
    robot.hear(/trello board/i, function (res_r) {
        // TODO: fetch the board id from other source (env, redis or mongodb)
        let boardId = 'BE7seI7e';
        let args = { fields: "name,url,prefs" };

        trello.get("/1/board/" + boardId, args, function (err, data) {
            if (err) {
                res_r.send(err);
                robot.logger.error(err);
                return 0;
            }
            // else !err
            let msg = slackmsg.buttons();
            msg.attachments[0].title = `<${data.url}|${data.name}>`;
            msg.attachments[0].title_url = 'www.google.com'
            msg.attachments[0].author_name = 'Board'
            msg.attachments[0].callback_id = `trello_board`;
            msg.attachments[0].color = `${data.prefs.backgroundColor}`;

            // attach the board lists to buttons
            let joinBtn = { "name": "join", "text": "Join", "type": "button", "value": "join" };
            let subBtn = { "name": "sub", "text": "Subscribe", "type": "button", "value": "sub" };
            let starBtn = { "name": "star", "text": "Star", "type": "button", "value": "star" };
            let listsBtn = { "name": "lists", "text": "Lists", "type": "button", "value": "lists" };
            let doneBtn = { "name": "done", "text": "Done", "type": "button", "value": "done", "style": "danger" };
            msg.attachments[0].actions.push(joinBtn);
            msg.attachments[0].actions.push(subBtn);
            msg.attachments[0].actions.push(starBtn);
            msg.attachments[0].actions.push(listsBtn);
            msg.attachments[0].actions.push(doneBtn);

            res_r.send(msg);
        })
    })

    var slackCB = 'slack:msg_action:';

    // responding to 'trello_board' interactive message
    robot.on(slackCB + 'trello_board', function (data, res) {
        robot.logger.info(`robot.on: ${slackCB}trello_board`);
        let btnId = data.actions[0].value;
        let btnName = data.actions[0].name;
        let response_url = data.response_url;
        let msg;

        switch (btnId) {
            case 'join':
                break;
            case 'sub':
                break;
            case 'star':
                break;
            case 'lists':
                res.status(200).end(); // best practice to respond with 200 status           
                // get board info to fetch lists
                let boardId = 'BE7seI7e';
                let args = { lists: "all" };
                trello.get("1/board/" + boardId, args, function (err, data) {
                    if (err) {
                        res.send(err);
                        robot.logger.error(err);
                        return;
                    }
                    // else if (!err)
                    // create buttons msg
                    let msg = slackmsg.buttons();
                    msg.text = `*${data.name}* board`;

                    msg.attachments[0].text = `Available lists`;
                    msg.attachments[0].callback_id = `trello_list`;
                    let listsNum = Object.keys(data.lists).length;
                    for (var i = 0; i < listsNum; i++) {
                        // TODO change value to some id or something similar
                        let name = data.lists[i].name;
                        let id = data.lists[i].id;
                        let list = { "name": name, "text": name, "type": "button", "value": id };
                        msg.attachments[0].actions.push(list);
                    }
                    sendMessageToSlackResponseURL(response_url, msg);
                })
                break;
            case 'done':
                //res.status(200).end() // best practice to respond with 200 status
                msg = slackmsg.plainText();
                res.send(msg);
                //sendMessageToSlackResponseURL(response_url, msg);
                // res.send(msg);
                break;
            default:
                //Statements executed when none of the values match the value of the expression
                break;
        }
    })

    // responding to 'trello_list' interactive message
    robot.on(slackCB + 'trello_list', function (data_board, res) {
        let response_url = data_board.response_url;

        res.status(200).end() // best practice to respond with 200 status
        robot.logger.info(`robot.on: ${slackCB}trello_list`);
        let listId = data_board.actions[0].value;
        let listName = data_board.actions[0].name;

        // call function to fetch list - provide list id
        let args = { cards: "all" };
        trello.get("/1/lists/" + listId, args, function (err, data) {
            if (err) {
                robot.logger.error(err);
                res.send(`Error: ${err}`)
                return 0;
            }
            // else !err
            // create buttons msg
            let msg = slackmsg.buttons();
            msg.text = `*${listName}* list`;
            msg.attachments[0].text = `Available Cards`;
            msg.attachments[0].callback_id = `trello_list`;

            let cardsNum = Object.keys(data.cards).length;
            robot.logger.info(`total cards: ${cardsNum}`);
            for (var i = 0; i < cardsNum; i++) {
                let card = data.cards[i].name;
                let cardId = data.cards[i].id;
                let item = { "name": card, "text": card, "type": "button", "value": cardId };
                msg.attachments[0].actions.push(item);
            }

            // respond with information for that list
            sendMessageToSlackResponseURL(response_url, msg);
        })
    })
    */

}
