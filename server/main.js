var game = require('./game.js');

function run() {
    console.log("Update cycle:");
    game.update("cake_1");
}

game.login();
setInterval(run, 1000);
