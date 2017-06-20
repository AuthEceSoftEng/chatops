var mongo = require('mongoskin');
var Promise = require("bluebird");

// mLab connection URI
var uri = process.env.HEROKU_MLAB_URI; 

// promisify mongoskin with bluebird
Object.keys(mongo).forEach(function (key) {
    var value = mongo[key];
    if (typeof value === "function") {
        Promise.promisifyAll(value);
        Promise.promisifyAll(value.prototype);
    }
});
Promise.promisifyAll(mongo);

// connect to mLab database
var db = mongo.MongoClient.connect(uri);

module.exports.db = function(){return db;}
