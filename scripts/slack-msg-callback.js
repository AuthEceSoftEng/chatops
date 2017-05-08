/* VERY IMPORTANT! 
 * If there isn't any verification token against the one on the 
 * slack's app basic info page, anyone can trigger these actions.
 */
var slackToken = process.env.HUBOT_SLACK_VERIFY_TOKEN;

module.exports = (robot) => {


  robot.respond(/slack token/i, function(res) {
    res.reply(slackToken)
  })


  robot.router.post('/hubot/slack-msg-callback', (req, res) => {
    var data = null;

    if(req.body.payload) {
      try {
        data = JSON.parse(req.body.payload);
      } catch(e) {
        robot.logger.error("Invalid JSON submitted to Slack message callback");
        res.send('You supplied invalid JSON to this endpoint.');
        //res.send(422)
        return;
      }
    } else {
      robot.logger.error("Non-JSON submitted to Slack message callback");
      res.send('You supplied invalid JSON to this endpoint.');
      //res.send(422)
      return;
    }

    if(data.token === slackToken) {
      robot.logger.info("Request is good");
    } else {
      robot.logger.error("Token mismatch on Slack message callback");
      res.send('You are not authorized to use this endpoint.');
      //res.send(403)
      return;
    }

    var handled = robot.emit(`slack:msg_action:${data.callback_id}`, data, res);
    if (!handled) {
      res.send('No scripts handled the action.');
      //res.send(550)
      //res.send(data)
    }
  });
};
