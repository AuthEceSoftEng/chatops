/** DEPRECATED **/




var encryption = require('./encryption.js');
var Promise = require("bluebird");
var q = require('q')
var key = process.env.HUBOT_TRELLO_KEY; // get it from https://trello.com/app-key

module.exports.trelloLogin = function (userId) {
    var deferred = q.defer();

    // connect to mLab database
    var db = require('./mlab-login.js').db();
    // bind trelloTokens collection
    db.bind('trelloTokens');

    db.trelloTokens.findOneAsync({ id: userId }).then(dbData => {
        var decryptedToken = dbData.token;
        var token = encryption.decrypt(decryptedToken);
        var t = new Trello(key, token);
        var trello = Promise.promisifyAll(t);
        deferred.resolve(trello);
    }).catch(dbError => {
        console.log(dbError);
        deferred.reject(dbError);
    })
    // return the promise
    return deferred.promise; 
}
