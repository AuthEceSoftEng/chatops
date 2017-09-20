var cache = require('./cache.js').getCache()

module.exports = function (robot) {

    robot.hear(/test (.*)/, res => {
        res.reply(res.match[1])

        robot.messageRoom(res.message.room, 'haha')

    })



}