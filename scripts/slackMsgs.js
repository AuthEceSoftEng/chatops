module.exports = {


    menu: function(){
        return {
                "text": "",
                "mrkdwn": true,
                "response_type": "in_channel",
                "attachments": [
                    {
                        "text": "",
                        "fallback": "",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "callback_id": "null",
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
                                        "text": "",
                                        "value": ""
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
    },

    buttons: function(){
        return {} //TODO
    }   
}