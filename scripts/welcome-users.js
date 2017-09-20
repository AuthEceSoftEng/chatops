var enterReplies, leaveReplies;

enterReplies = ['Hi', 'Target Acquired', 'Firing', 'Hello friend.', 'Gotcha', 'I see you'];

leaveReplies = ['Are you still there?', 'Target lost', 'Searching'];

module.exports = function(robot) {
  robot.enter(function(res) {
      console.log(res.message.user.id)
    return res.send(res.random(enterReplies));
  });
  return robot.leave(function(res) {
    return res.send(res.random(leaveReplies));
  });
};
