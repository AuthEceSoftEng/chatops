var fs = require('fs')
var http = require('http')

module.exports = function (robot) {

    robot.router.get('/', function (request, response) {
        fs.readFile(__dirname + "/html/homepage.html", function (err, html) {
            if (err) {
                console.log(err)
                response.writeHead(404);
                response.write('Not Found');
            } else {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.write(html);
            }
            response.end()
        })

    })


    robot.router.get('/token%20received', function (request, response) {
        fs.readFile(__dirname + "/html/token-received.html", function (err, html) {
            if (err) {
                console.log(err)
                response.writeHead(404);
                response.write('Not Found');
            } else {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.write(html);
            }
            response.end()
        })

    })

    robot.router.get('/icons/trelloCard', function (request, response) {

        fs.readFile(__dirname + '/icons/trelloCard.png', function (err, icon) {
            if (err) {
                console.log(err)
                response.writeHead(404);
                response.write('Not Found');
            } else {
                response.writeHead(200, { 'Content-Type': 'image/png' });
                response.write(icon);
            }
            response.end()

        })
    })
}