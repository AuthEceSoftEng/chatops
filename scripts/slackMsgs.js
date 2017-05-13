// module.exports = {
//   sayHelloInEnglish: function() {
//     return "HELLO";
//   },
       
//   sayHelloInSpanish: function() {
//     return "Hola";
//   }
// };

module.exports = {


    menu: function(){
        return {
                "text": "",
                "response_type": "in_channel",
                "attachments": [
                    {
                        "text": "",
                        "fallback": "",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "callback_id": "null",
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


