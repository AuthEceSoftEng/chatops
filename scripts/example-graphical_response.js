module.exports = function(robot) {

  var games_buttons = require('./example-buttons.json');
  var games_menu = require('./example-menu.json');

  robot.respond(/games - buttons/i, function(res) {
	res.reply(games_buttons)
  })

  robot.respond(/games - menu/i, function(res) {
	res.reply(games_menu)
  })

}
