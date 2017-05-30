module.exports = {

    getChannelName: function(robot, res){
        return (robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(res.message.room)).name;
    },

    getUserName: function(res){
        return res.message.user.name;
    },

    getChannelId: function(res){
        return  res.message.room;
    },

    getUserId: function(res){
        return res.message.user.id;
    },

    getTeamId: function(res){
        return res.message.user.team_id;
    },

    menu: function(){
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

    buttons: function(){
        return {
                "text": "",
                "response_type": "in_channel",
                "replace_original": true,
                "delete_original": true,
                "attachments": [
                    {   
                        "title":"",
                        "title_link":"",
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

    basicMessage: function(){
        return {
            "attachments": [
                {
                    "fallback": "",
                    "mrkdwn_in": ["text", "pretext"],
                    "color": "#36a64f",
                    "pretext": "Please get a token to authorize your Trello account",
                    "title": "Slack API Documentation",
                    "title_link": "",
                    "text": "Copy the token from the link above and run\n *trello add token <YOUR TOKEN>*",
                    "footer": "Trello Authorization",
                    "footer_icon": "https://d2k1ftgv7pobq7.cloudfront.net/meta/u/res/images/b428584f224c42e98d158dad366351b0/trello-mark-blue.png"        }
            ]
        }
    },

    // only visible to the user involved 
    ephemeralMsg: function(){
        return {
          "response_type": "ephemeral",
          "replace_original": false,
          "text": "This is an ephemeral msg!"
        }
    },

    plainText: function(){
        return {
          "response_type": "in_channel",
          "replace_original": false,
          "text": "text here",
          //"response_type": "ephemeral",
          "delete_original": true
        }
    }

    
}


