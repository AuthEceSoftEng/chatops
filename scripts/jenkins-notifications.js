var slackMsg = require('./slackMsgs.js')

var jenkins_url = process.env.JENKINS_URL
var HUBOT_JENKINS_COLOR_ABORTED = process.env.HUBOT_JENKINS_COLOR_ABORTED || "warning"
var HUBOT_JENKINS_COLOR_FAILURE = process.env.HUBOT_JENKINS_COLOR_FAILURE || "danger"
var HUBOT_JENKINS_COLOR_FIXED = process.env.HUBOT_JENKINS_COLOR_FIXED || "#d5f5dc"
var HUBOT_JENKINS_COLOR_STARTED = process.env.HUBOT_JENKINS_COLOR_STARTED || "#b2f7c1"
var HUBOT_JENKINS_COLOR_STILL_FAILING = process.env.HUBOT_JENKINS_COLOR_STILL_FAILING || "danger"
var HUBOT_JENKINS_COLOR_SUCCESS = process.env.HUBOT_JENKINS_COLOR_SUCCESS || "good"
var HUBOT_JENKINS_COLOR_DEFAULT = process.env.HUBOT_JENKINS_COLOR_DEFAULT || "#ffe094"

module.exports = function (robot) {

    return robot.router.post("/hubot/jenkins-notifications", function (req, res) {
        var color, params, payload, status

        var room = null
        if (req.query.room && !req.query.user) {
            room = req.query.room
        }
        else if (req.query.user && !req.query.room) {
            room = '@' + req.query.user
        }
        else if (req.query.user && req.query.room) {
            room = req.query.room
            robot.logger.info('Jenkins notification URL: Must use room OR user parameter. Not both.')
        }
        else if (!req.query.user && !req.query.room) {
            throw new Error('Jenkins notification URL: Must use room or user parameter')
        }

        var data = req.body
        res.status(202).end() // Accepted

        // TODO: delete it or not
        if (data.build.phase === "COMPLETED") {
            return
        }


        var msg = slackMsg.basicMessage()
        msg.attachments[0].fields.push({
            title: "Phase",
            value: data.build.phase,
            short: true
        })

        switch (data.build.phase) {
            case "FINALIZED":
                status = data.build.phase
                msg.attachments[0].fields.push({
                    title: "Status",
                    value: data.build.status,
                    short: true
                })
                color = (function () {
                    switch (data.build.status) {
                        case "ABORTED":
                            return HUBOT_JENKINS_COLOR_ABORTED
                        case "FAILURE":
                            return HUBOT_JENKINS_COLOR_FAILURE
                        case "FIXED":
                            return HUBOT_JENKINS_COLOR_FIXED
                        case "STILL FAILING":
                            return HUBOT_JENKINS_COLOR_STILL_FAILING
                        case "SUCCESS":
                            return HUBOT_JENKINS_COLOR_SUCCESS
                        default:
                            return HUBOT_JENKINS_COLOR_DEFAULT
                    }
                })()
                break
            case "STARTED":
                status = data.build.phase
                color = HUBOT_JENKINS_COLOR_STARTED
                msg.attachments[0].fields.push({
                    title: "Build #",
                    value: `<${jenkins_url}/${data.build.url}|${data.build.number}>`,
                    short: true
                })
                params = data.build.parameters
                if (params && params.ghprbPullId) {
                    msg.attachments[0].fields.push({
                        title: "Source branch",
                        value: params.ghprbSourceBranch,
                        short: true
                    })
                    msg.attachments[0].fields.push({
                        title: "Target branch",
                        value: params.ghprbTargetBranch,
                        short: true
                    })
                    msg.attachments[0].fields.push({
                        title: "Pull request",
                        value: params.ghprbPullId + ": " + params.ghprbPullTitle,
                        short: true
                    })
                    msg.attachments[0].fields.push({
                        title: "URL",
                        value: params.ghprbPullLink,
                        short: true
                    })
                } else if (data.build.scm.commit) {
                    var commit = data.build.scm.commit
                    var commit_url = data.build.scm.url + '/commit/' + commit
                    msg.attachments[0].fields.push({
                        title: "Commit SHA1",
                        value: `<${commit_url}|${commit.substring(0, 7)}>`,
                        short: true
                    })
                    msg.attachments[0].fields.push({
                        title: "Branch",
                        value: data.build.scm.branch,
                        short: true
                    })
                }
                break
            case 'QUEUED':
                status = data.build.phase
                msg.attachments[0].fields.pop()
                break
            default:
                status = null
                break
        }
        msg.attachments[0].color = color
        var build_full_url = `${jenkins_url}/${data.build.url}`
        msg.attachments[0].pretext = `Jenkins ${data.name} <${build_full_url}|#${data.build.number}> ${status}`
        msg.attachments[0].fallback = msg.attachments[0].pretext

        robot.messageRoom(room, msg)

        // for debugging:
        // console.log('\n', data) 

    })
}