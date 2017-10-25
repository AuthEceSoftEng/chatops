// Commands: 
//   `standups email report` - Send weedkly standups in CSV file to the preconfigured email 
//   `standups email weekly report` - Send weedkly standups in CSV file to the preconfigured email 
//   `standups email today report` - Send daily standups in CSV file to the preconfigured email 
//   `standups email report (to) <email>` - Send weedkly standups in CSV file to the given email 
//   `standups email weekly report (to) <email>` - Send weedkly standups in CSV file to the given email 
//   `standups email today report (to) <email>` - Send daily standups in CSV file to the given email 


'use strict'

const Conversation = require('./hubot-conversation/index.js')
const nodemailer = require('nodemailer')
var c = require('./config.json')
var json2csv = require('json2csv');
var path = require("path")
var fs = require('fs')
var dateFormat = require('dateformat')
var Promise = require('bluebird')
var mongoskin = require('mongoskin')
Promise.promisifyAll(mongoskin)

// config
var mongodb_uri = process.env.MONGODB_URL
var hubot_email = process.env.HUBOT_EMAIL
var hubot_email_pass = process.env.HUBOT_EMAIL_PASS
var standups_email = process.env.STANDUPS_EMAIL
var errorChannel = process.env.HUBOT_ERRORS_CHANNEL || null
// if (!mongodb_uri || !hubot_email || !hubot_email_pass) {
//     return
// }

module.exports = function (robot) {

    robot.hear(/standup email( weekly|) reports?(( to)? (.*))?/i, function (res) {
        var date = new Date()
        var startDate = date.setDate(date.getDate() - 7);
        var dateQuery = { $gte: new Date(startDate) }
        var email_to = res.match.pop()
        if (email_to!='undefined') {
            sendReportListener(res, dateQuery, email_to)
        } else {
            sendReportListener(res, dateQuery)
        }
    })

    robot.hear(/standup email (today|current day) reports?(( to)? (.*))?/i, function (res) {
        var date = dateFormat(new Date(), 'yyyy-mm-dd')
        date = date.split('-')
        var dateQuery = new Date(`${date[0]}-${date[1]}-${date[2]}`)
        sendReportListener(res, dateQuery)
    })


    function sendReportListener(res, dateQuery, email = standups_email) {
        var username = res.message.user.name
        var userRealName = res.message.user.real_name
        var fullUserName = `${userRealName} (${username})`
        fetchReport(dateQuery)
            .then(report => {
                res.reply('Converting reports to CSV file and sending it right away.\nIt might take a few seconds, be patient..')
                return createCSVReport(report)
            })
            .then(() => {
                return sendReportToEmail(fullUserName, email, dateQuery)
            })
            .then((response) => {
                if (response.statusCode == 200)
                    res.reply(`An email with a CSV file attached has been sent to ${email}`)
            })
            .then(() => {
                return fs.unlink('./report.csv', (err) => {
                    if (err) throw err
                })
            })
            .catch(error => {
                res.reply(error.message)
                robot.logger.error(error)
            })
    }

    function fetchReport(dateQuery) {
        var db = mongoskin.MongoClient.connect(mongodb_uri)
        return db.bind('standupReports').find({
            createdAt: dateQuery
        }).toArrayAsync()
            .then(reports => {
                if (!reports.length) {
                    return Promise.reject({ message: 'No reports found', statusCode: 404 })
                } else {
                    return Promise.resolve(reports)
                }
            })
            .catch(error => {
                return Promise.reject(error)
            })
    }

    function createCSVReport(reportsArray) {
        var json2csvData = []
        return Promise.each(reportsArray, function (reportObj) {
            var reports = reportObj.reports
            var user = robot.brain.userForId(reportObj.userid)
            var memberName = user.real_name
            var memberUsername = user.name
            var date = dateFormat(reportObj.createdAt, "dd/mm/yyyy, HH:MM")


            return Promise.each(reports, function (report) {
                var tempCsvData = {}
                tempCsvData.member = `${memberName} (${memberUsername})`
                return Promise.each(report, function (qna) {
                    tempCsvData[qna.question] = qna.answer
                }).then(() => {
                    json2csvData.push(tempCsvData)
                })

            })
        }).done(() => {
            if (json2csvData.length > 0) {
                var csv = json2csv({ data: json2csvData })
                fs.writeFile('report.csv', csv, function (err) {
                    if (err) throw err;
                })
            }
        })
    }

    function sendReportToEmail(user, email_to, dateQuery) {
        return new Promise(function (resolve, reject) {
            return nodemailer.createTestAccount((err, account) => {
                // create reusable transporter object using the default SMTP transport
                var host = process.env.HUBOT_EMAIL_HOST || 'smtp.outlook.com'
                var port = process.env.HUBOT_EMAIL_PORT || 587
                let transporter = nodemailer.createTransport({
                    host: process.env.HUBOT_EMAIL_HOST || 'smtp.outlook.com',
                    port: process.env.HUBOT_EMAIL_PORT || 587,
                    secure: port === 465, // true for 465, false for other ports
                    auth: {
                        user: hubot_email, // generated ethereal user
                        pass: hubot_email_pass  // generated ethereal password
                    }
                })

                // email text
                var dateText
                if (dateQuery['$gte']) {
                    dateText = 'since ' + dateFormat(new Date(dateQuery['$gte']), 'fullDate')
                } else {
                    dateText = 'for ' + dateFormat(new Date(dateQuery), 'fullDate')
                }

                // setup email data with unicode symbols
                let mailOptions = {
                    from: `${robot.name} <${hubot_email}>`,
                    to: `<${email_to}>`,
                    subject: 'Slack Standup-Reports ✔',
                    text: `Slack Standup-Reports ${dateText}. Email sent by ${user} using ${robot.name}`,
                    attachments: [{
                        filename: 'report.csv',
                        path: './report.csv'
                    }]
                }

                // send mail with defined transport object
                return transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        reject(error)
                    }
                    robot.logger.info('Email sent: ' + info.messageId)
                    resolve({ message: `Εmail sent ${info}`, statusCode: 200 })
                    // Preview only available when sending through an Ethereal account
                    // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info))
                })
            })
        })
    }

}