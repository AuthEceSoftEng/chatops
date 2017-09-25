// Configuration:
// Commands:
//   `JENKINS`
//   `jenkins builds of job <job name>`
//   `jenkins last successful build of job <job name>`
//   `jenkins last completed build of job <job name>`
//   `jenkins last build of job <job name>`
//   `jenkins build info <build number> of job <job name>`
//   `jenkins build console <build number> of job <job name>`
//   `jenkins build job <job_name>`
//   `jenkins jobs`


var jenkinsapi = require('jenkins-api');
var Promise = require('bluebird')
var request = require('request-promise')
var cache = require('./cache.js').getCache()
var async = require('async')
var c = require('./config.json')
var dateFormat = require('dateformat');
var slackmsg = require('./slackMsgs.js')
var color = require('./colors.js')

// config
var jenkins_url = process.env.JENKINS_URL
var url = process.env.JENKINS_URL.split('//');
var uri = url[1]
var protocol = url[0];
var df = "dd/mm/yyyy, hh:MM TT"

module.exports = function (robot) {

    /*************************************************************************/
    /*                              Listeners                                */
    /*************************************************************************/

    robot.respond(/jenkins builds of job (.*)/i, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[1]
        getAllBuilds(userid, jobName)
    })

    robot.on('listJobBuilds', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        getAllBuilds(userid, jobName)
    })


    robot.respond(/jenkins last success?f?u?l? build of job (.*)/i, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[1]
        getLastSuccessfulBuild(userid, jobName)
    })

    robot.on('listLastSuccessfulBuild', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        getLastSuccessfulBuild(userid, jobName)
    })


    robot.respond(/jenkins last completed? build of job (.*)/i, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[1]
        getLastCompletedBuild(userid, jobName)
    })

    robot.on('listLastCompletedBuild', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        getLastCompletedBuild(userid, jobName)
    })


    robot.respond(/jenkins last build of job (.*)/i, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[1]
        getLastBuildInfo(userid, jobName)
    })

    robot.on('listLastBuild', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        getLastBuildInfo(userid, jobName)
    })


    robot.respond(/jenkins build info (.*) of job (.*)/i, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[2]
        var buildNum = res.match[1]
        getBuildInfo(userid, jobName, buildNum)
    })

    robot.on('showBuildInfo', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        var buildNum = data.parameters.buildNum
        getBuildInfo(userid, jobName, buildNum)
    })


    robot.respond(/jenkins build console (\d+) of job (.*)/, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[2]
        var buildNum = res.match[1]
        getBuildConsole(userid, jobName, buildNum)
    })

    robot.on('showBuildConsole', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        var buildNum = data.parameters.buildNum
        getBuildConsole(userid, jobName, buildNum)
    })


    robot.respond(/jenkins build job (.*)/, function (res) {
        var userid = res.message.user.id
        var jobName = res.match[1]
        buildJob(userid, jobName)
    })

    robot.on('buildJob', function (data, res) {
        var userid = res.message.user.id
        var jobName = data.parameters.jobName
        buildJob(userid, jobName)
    })


    robot.respond(/\bjenkins jobs$\b/i, function (res) {
        var userid = res.message.user.id
        getAllJobs(userid)
    })

    robot.on('listJobs', function (data, res) {
        var userid = res.message.user.id
        getAllJobs(userid)
    })

    
    /*************************************************************************/
    /*                            API CALLS                                  */
    /*************************************************************************/

    function getAllJobs(userid) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var args = '?tree=jobs[name,id,url,color]&pretty=true'
        var options = {
            url: `${jenkins_url}/api/json${args}`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };

        request(options)
            .then(data => {
                var jobs = data.jobs
                var msg = { attachments: [] }
                jobs.forEach(function (job) {
                    var att = slackmsg.attachment()

                    att.title = `<${job.url}|${job.name}>`
                    att.fallback = att.title
                    att.text = `Class: ${job._class}`
                    att.color = color.getHex(job.color)
                    msg.attachments.push(att)
                })
                return msg
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })


    }

    function getAllBuilds(userid, jobName) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var args = '?depth=1&tree=builds[id,timestamp,result,duration]&pretty=true'
        var options = {
            url: `${jenkins_url}/job/${jobName}/api/json${args}`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };

        request(options)
            .then(data => {
                var builds = data.builds
                var msg = { attachments: [] }
                builds.forEach(function (item) {
                    var att = slackmsg.attachment()
                    var date = new Date(item.timestamp)
                    att.title = `<${jenkins_url}/job/${jobName}/${item.id}|Build #${item.id}>`
                        + ` (${dateFormat(date, df)})`
                    att.fallback = att.title
                    att.text = `Result: ${item.result} | Duration: ${item.duration / 1000} s`
                    if (item.result == 'SUCCESS') {
                        att.color = 'good'
                    } else if (att.color.includes('FAIL')) {
                        att.color = 'danger'
                    } else {
                        att.color = 'warning'
                    }
                    msg.attachments.push(att)
                })
                return msg
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
            })
    }

    function getLastSuccessfulBuild(userid, jobName) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `${jenkins_url}/job/${jobName}/lastSuccessfulBuild/api/json`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };
        request(options)
            .then(item => {
                return generateBuildInfoMsg(item)
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
                console.log(error)
            })
    }

    function getLastCompletedBuild(userid, jobName) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `${jenkins_url}/job/${jobName}/lastCompletedBuild/api/json`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };
        request(options)
            .then(item => {
                return generateBuildInfoMsg(item)
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
                console.log(error)
            })
    }

    function getLastBuildInfo(userid, jobName) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `${jenkins_url}/job/${jobName}/lastBuild/api/json`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };

        request(options)
            .then(data => {
                return generateBuildInfoMsg(data)
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
            })
    }

    function getBuildInfo(userid, jobName, buildNum) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `${jenkins_url}/job/${jobName}/${buildNum}/api/json`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };

        request(options)
            .then(data => {
                var lastBuild = data.lastBuild
                return generateBuildInfoMsg(data)
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
            })
    }

    function getBuildConsole(userid, jobName, buildNum) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `${jenkins_url}/job/${jobName}/${buildNum}/consoleText/api/json`,
            method: 'GET',
            auth: {
                'user': cred.username,
                'pass': cred.token
            },
            json: true
        };

        request(options)
            .then(data => {
                return msg = '```' + data + '```'
            })
            .then(msg => {
                robot.messageRoom(userid, msg)
            })
            .catch(error => {
                errorHandler(userid, error)
            })
    }

    function buildJob(userid, jobName) {
        var cred = getCredentials(userid)
        if (!cred) { return 0 }

        var options = {
            url: `http://localhost:9999/job/${jobName}/build`,
            method: 'POST',
            headers: {
                'Jenkins-Crumb': cred.crumb
            },
            auth: {
                'user': cred.username,
                'pass': cred.token
            }
        };

        request(options)
            .then(data => {
                robot.messageRoom(userid, `I'm on it!`)
            })
            .catch(error => {
                errorHandler(userid, error)
            })


    }

    /*
        NOT IMPLEMENTED:
        update
        create
        copy
        delete
        enable
        disaple
    */


    /*************************************************************************/
    /*                          helpful functions                            */
    /*************************************************************************/


    function getCredentials(userid) {

        try {
            var token = cache.get(userid).jenkins_token
            var username = cache.get(userid).jenkins_username
            //TODO
            var crumb = cache.get(userid).jenkins_crumb
            if (!token || !username) { // catch the case where username or token are null/undefined
                throw error
            }
        } catch (error) {
            robot.emit('jenkinsLogin', userid)
            return false
        }
        return {
            username: username,
            token: token,
            crumb: crumb
        }
    }

    function errorHandler(userid, error) {
        if (error.statusCode == 401) {
            robot.messageRoom(userid, c.jenkins.badCredentialsMsg)
        }
        else if (error.statusCode == 404) {
            robot.messageRoom(userid, c.jenkins.jobNotFoundMsg)
        }
        else {
            robot.messageRoom(userid, c.errorMessage + 'Status Code: ' + error.statusCode)
            robot.logger.error(error)
        }
    }


    function generateBuildInfoMsg(item) {
        return new Promise(function (resolve, reject) {
            var msg = { attachments: [] }
            var att = slackmsg.attachment()

            // msg text & fallback: Build #num (timestamp)
            var date = new Date(item.timestamp)
            msg.text = `*<${item.url}|${item.fullDisplayName}>`
                + ` (${dateFormat(date, df)})*`
            att.fallback = msg.text

            // color
            if (item.result == 'SUCCESS') {
                att.color = 'good'
            }
            else if (att.color.includes('FAIL')) {
                att.color = 'danger'
            }
            else {
                att.color = 'warning'
            }

            // attachement text
            // build result: <result> | Duration: #.### s
            att.text = `Result: ${item.result} | Duration: ${item.duration / 1000} s`

            // FIELDS
            // build description
            if (item.description) {
                att.fields.push({
                    title: 'Description:',
                    value: item.description,
                    short: false
                })
            }

            // build changes
            var fieldTitle2 = '', value2 = ''
            if (item.changeSet.items.length) {
                fieldTitle2 = 'Changes:'
            }
            item.changeSet.items.forEach(function (change) {
                value2 += `• ${change.comment}`
            })
            att.fields.push({
                title: fieldTitle2,
                value: value2,
                short: false
            })

            msg.attachments.push(att)
            return resolve(msg)

        })
    }


}