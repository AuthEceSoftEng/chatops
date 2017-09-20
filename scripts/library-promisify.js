// promisify lib using bluebird

'use strict'

module.exports = function (lib) {
    var Promise = require('bluebird');

    Object.keys(lib).forEach(function (key) {
        var value = lib[key];
        if (typeof value === "function") {
            Promise.promisifyAll(value);
            Promise.promisifyAll(value.prototype);
        }
    });
    return Promise.promisifyAll(lib);
}