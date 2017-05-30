module.exports = function(robot) {
    'use strict'

    var slackmsg = require("./slackMsgs.js");
    var request = require('request');
    var Trello = require('node-trello');

    // auth
    var key = process.env.HUBOT_TRELLO_KEY;
    var token = process.env.HUBOT_TRELLO_TOKEN;
    var trello = new Trello(key, token);

    function sendMessageToSlackResponseURL(responseURL, JSONmessage){
      var postOptions = {
          uri: responseURL,
          method: 'POST',
          headers: {
              'Content-type': 'application/json'
          },
          json: JSONmessage
      };
      request(postOptions, (error, response, body) => {
          if (error){
              // handle errors as you see fit
          };
      })
    }



    // Associate a board with a specific Channel 
    robot.hear(/trello board (.*)/i, function(res_r) {
        let board = res_r.match[1];
        // TODO!
    })


    // trello board
    robot.hear(/trello board/i, function(res_r){
        // TODO: fetch the board id from other source (env, redis or mongodb)
        let boardId = 'BE7seI7e';
        let args = {fields: "name,url,prefs"};

        trello.get("/1/board/"+boardId, args, function(err, data){
            if (err){
                res.send('Error: ' + err);
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
            let joinBtn = {"name": "join", "text": "Join","type":"button", "value": "join"};
            let subBtn  = {"name": "sub", "text": "Subscribe","type":"button", "value": "sub"};
            let starBtn = {"name": "star", "text": "Star","type":"button", "value": "star"};
            let listsBtn= {"name": "lists", "text": "Lists","type":"button", "value": "lists"};
            let doneBtn = {"name": "done", "text": "Done","type":"button", "value": "done","style": "danger"};
            msg.attachments[0].actions.push(joinBtn);
            msg.attachments[0].actions.push(subBtn);
            msg.attachments[0].actions.push(starBtn);
            msg.attachments[0].actions.push(listsBtn);
            msg.attachments[0].actions.push(doneBtn);

            res_r.send(msg);
        }) 
    })


    
    /*******************************************************************/
    /*                        robot.on listeners                       */
    /*******************************************************************/

    var slackCB = 'slack:msg_action:';

    // responding to 'trello_board' interactive message
    robot.on(slackCB + 'trello_board', function(data, res){
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
            res.status(200).end() // best practice to respond with 200 status           
            // get board info to fetch lists
            let boardId = 'BE7seI7e';
            let args = {lists:"all"};
            trello.get("1/board/"+boardId, args, function(err, data){
                if (err){
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
                for (var i=0; i<listsNum; i++){
                    // TODO change value to some id or something similar
                    let name = data.lists[i].name;
                    let id = data.lists[i].id;
                    let list = {"name": name, "text": name, "type":"button", "value": id};
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
    robot.on(slackCB + 'trello_list', function(data_board, res){
        let response_url = data_board.response_url;

        res.status(200).end() // best practice to respond with 200 status
        robot.logger.info(`robot.on: ${slackCB}trello_list`);
        let listId = data_board.actions[0].value;
        let listName = data_board.actions[0].name;

        // call function to fetch list - provide list id
        let args = {cards: "all"};
        trello.get("/1/lists/"+listId, args, function(err, data){
            if (err){
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
            for (var i=0; i<cardsNum; i++){
                let card    = data.cards[i].name;
                let cardId  = data.cards[i].id;
                let item    = {"name": card, "text": card,"type":"button", "value": cardId};
                msg.attachments[0].actions.push(item);
            }

            // respond with information for that list
            sendMessageToSlackResponseURL(response_url, msg);
        })
    })





    
    /*  TODO: add more functionality */ 


}








    /* developer's personal notes */

    /* template */

    // robot.respond(/trello /i, function(res_r) {
    //     t.post("/1/", function(err, data){
    //         if (err){
    //             res_r.send('Error Encountered: '+ err['responseBody']);
    //         }
    //     })
    // })





/* An example of using slack's response_url. ~For future use */
/* Add this snippet inside robot.on that u want to trigger   */

    // var response_url = data.response_url;
    // var slackMsg = require('./slackMsgs');
    // var response = slackMsg.ephemeralMsg();

    // sendMessageToSlackResponseURL(response_url, response);





