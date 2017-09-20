module.exports = {

    getChannelName: function (robot, res) {
        return (robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(res.message.room)).name;
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
    }
}