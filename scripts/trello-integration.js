module.exports = function(robot) {


    var Trello = require("node-trello");

    var key = process.env.HUBOT_TRELLO_KEY;
    var token = 'jvh';process.env.HUBOT_TRELLO_TOKEN;

    var t = new Trello(key, token);

    robot.respond(/trello account name/i, function(res_r) {

        t.get("/1/members/me", function(err, data) {
            if (err) {
                //console.log(err);
                //throw err;
                res_r.send('Error: ' + err['responseBody']);
                return false;
            };
            //res_r.send(res);
            res_r.send(data['fullName']);
        });
    })


    /*/
    /// TODO: add more functionality 
    /*/
}