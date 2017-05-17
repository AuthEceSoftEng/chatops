
var Trello = require("node-trello");

var key = process.env.HUBOT_TRELLO_KEY;
var token = process.env.HUBOT_TRELLO_TOKEN;

//TODO: Get token using OAuth -> check here: https://glitch.com/edit/#!/trello-oauth

var t = new Trello(key, token);

t.get("/1/members/me", function(err, data) {
  if (err) {
  	console.log(err)
    throw err;
  };
  console.log(data);
});

// URL arguments are passed in as an object.
t.get("/1/members/me", { cards: "open" }, function(err, data) {
  if (err) {
  	console.log(err); 
  	throw err;
  };
  console.log(data);
})