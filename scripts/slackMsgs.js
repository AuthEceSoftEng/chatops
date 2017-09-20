module.exports = {

    getChannelName: function (robot, res) {
        return (robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(res.message.room)).name;
    },

    getChannelNameById: function (robot, roomid) {
        return (robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(roomid)).name;
    },
    getUserName: function (res) {
        return res.message.user.name;
    },

    getChannelId: function (res) {
        return res.message.room;
    },

    getUserId: function (res) {
        return res.message.user.id;
    },

    getTeamId: function (res) {
        return res.message.user.team_id;
    },

    menu: function () {
        return {
            "text": "",
            "mrkdwn": true,
            "response_type": "in_channel",
            "replace_original": false,
            "attachments": [
                {
                    "text": "",
                    "fallback": "",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "callback_id": "cb_id",
                    "mrkdwn_in": [
                        "text",
                        "pretext"
                    ],
                    "actions": [
                        {
                            "name": "",
                            "text": "",
                            "type": "select",
                            "options": [
                                {
                                    // To add menu items: 
                                    // item = {"text": text, "value": value} 
                                    // attachements[0].actions.[0].options.push(item)
                                    // "text": "",
                                    // "value": ""
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    },

    buttons: function () {
        return {
            "text": "",
            "response_type": "in_channel",
            "replace_original": true,
            "delete_original": true,
            "attachments": [
                {
                    "title": "",
                    "title_link": "",
                    "text": "",
                    "author_name": "",
                    "fallback": "",
                    "callback_id": "cb_id",
                    "mrkdwn_in": [
                        "text",
                        "pretext"
                    ],
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            // To add buttons: 
                            // item = {"name":name, "text": text, "type":"button", "value":value} 
                            // attachements[0].actions.push(item)

                            // "name": "",
                            // "text": "",
                            // "type": "",
                            // "value": ""
                        }
                    ]
                }
            ]
        }
    },
    basicMessage: function () {
        return {
            "text": "",
            "response_type": "in_channel",
            "attachments": [
                {
                    "title": "",
                    "title_link": "",
                    "text": "",
                    "pretext": "",
                    "fallback": "",
                    "color": "",
                    "footer": "",
                    "footer_icon": "",
                    "mrkdwn_in": ["text", "pretext", "fields"],
                    "fields":[]
                }
            ]
        }
    },

    githubEvent: function () {
        return {
            "text": "",
            "unfurl_links": false,
            "attachments": [
                {
                    "title": "",
                    "pretext": "",
                    "attachment_type": "default",
                    "fallback": null,
                    "color": "#bdc3c7",
                    "text": "",
                    "mrkdwn_in": [
                        "text",
                        "pretext",
                        "fields"
                    ]
                }
            ]
        }
    },
    attachmentMsg: function () {
        return {
            "text": "",
            "unfurl_links": false,
            "attachments": [
                {
                    "title": "",
                    "pretext": "",
                    "attachment_type": "default",
                    "fallback": null,
                    "color": "#bdc3c7",
                    "text": "",
                    "mrkdwn_in": [
                        "text",
                        "pretext",
                        "fields"
                    ]
                }
            ]
        }
    },
    attachment: function () {
        return {
            "title": "",
            "pretext": "",
            "attachment_type": "default",
            "fallback": null,
            "color": "#111111",
            "text": "",
            "fields":[],
            "mrkdwn_in": ["text", "pretext", "fields"]
        }
    },

    // only visible to the user involved 
    ephemeralMsg: function () {
        return {
            "response_type": "ephemeral",
            "replace_original": false,
            "text": "This is an ephemeral msg!"
        }
    },

    plainText: function () {
        return {
            "response_type": "in_channel",
            "replace_original": false,
            "text": "text here",
            //"response_type": "ephemeral",
            "delete_original": true
        }
    }

}