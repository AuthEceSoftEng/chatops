function startDialog(switchBoard, res, convModel, answers = {}, n = 0) {

    return new Promise((resolve, reject) => {

        var conversation = convModel.conversation
        if (n < conversation.length) {
            var dialog = switchBoard.startDialog(res, 1000 *60* 10);
            var question = conversation[n].question
            
            // handle multiple questions. Reply with a random one each time
            if (question.constructor == Array) {
                res.reply(question[getRandom(0, question.length)]);
            } 
            else {
                res.reply(question);
            }

            dialog.addChoice(/ ((.*\s*)+)/i, function (res) {
                msg = res.match[1]
                dialog.finish()

                if (convModel.abortKeyword.includes(msg)) {
                    res.reply(convModel.onAbortMessage)
                    reject('canceled')
                }
                else if (msg == 'skip' && conversation[n].answer.required) {
                    res.reply(convModel.requiredMessage)
                    resolve(startDialog(switchBoard, res, convModel, answers, n))
                }
                else if (msg == 'skip') {
                    answers[conversation[n].answer.name] = null
                    resolve(startDialog(switchBoard, res, convModel, answers, n + 1))
                }
                else {
                    /* check for answer types (choice, number) */
                    if (conversation[n].answer.type == 'choice') {
                        if (conversation[n].answer.match.includes(msg)) {
                            answers[conversation[n].answer.name] = msg
                            resolve(startDialog(switchBoard, res, convModel, answers, n + 1))
                        }
                        else {
                            resolve(startDialog(switchBoard, res, convModel, answers, n))
                        }
                    }
                    else if (conversation[n].answer.type == 'number') {
                        if (isNumber(msg)) {
                            answers[conversation[n].answer.name] = msg
                            resolve(startDialog(switchBoard, res, convModel, answers, n + 1))
                        }
                        else {
                            res.reply('(Answer must be a number)')
                            resolve(startDialog(switchBoard, res, convModel, answers, n))
                        }
                    } 
                    else { // this is string. no need to use else-if statement (last type remaining)
                        answers[conversation[n].answer.name] = msg
                        resolve(startDialog(switchBoard, res, convModel, answers, n + 1))
                    }
                }
            })
        }
        else {
            resolve(answers)
            res.reply(convModel.onCompleteMessage)
        }
    })

}

function createIssue(userid, data) {
    console.log(userid + ' ', data)
}

function isNumber(obj) { return !isNaN(parseFloat(obj)) }

// get an integer between [min, max) or [min, max-1]
function getRandom(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
}

module.exports = { startDialog };
