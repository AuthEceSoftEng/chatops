var CacheBase = require('cache-base').namespace('data')

var cache = new CacheBase()

module.exports.getCache = function () {
    return cache
}