'use strict'

const crypto = require('crypto')

const key = process.env.ENCRYPTION_KEY; // Must be   256 bytes (32 characters)
const algorithm = process.env.ENCRYPTION_ALGORITHM

if (!key || !algorithm) {
  return
}

function encrypt(text) {
  return new Promise((resolve, reject) => {
    if (!text) resolve()
    var cipher = crypto.createCipher(algorithm, key)
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex')
    resolve(crypted)
  })
}
function encryptSync(text) {
  if (!text) return null
  var cipher = crypto.createCipher(algorithm, key)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted
}

function decrypt(text) {
  return new Promise((resolve, reject) => {
    if (!text) resolve()
    var decipher = crypto.createDecipher(algorithm, key)
    var decrypted = decipher.update(text, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    resolve(decrypted)
  })
}

function decryptSync(text) {
  if (!text) return null;
  var decipher = crypto.createDecipher(algorithm, key)
  var decrypted = decipher.update(text, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

module.exports = { decrypt, encrypt, decryptSync, encryptSync }