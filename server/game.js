var bitcoin = require('bitcoin');
var program = require("commander");
var redis = require("redis");
var Q = require("q");

var dbh = null;
var btclient = null;
var redisPassword = "n9ip3fwvWOwzu4wi";
var redisDsn = "redis:pub-redis-17864.dal-05.1.sl.garantiadata.com:17864";

runProgram();


//commands:

function runProgram() {
    program.version('1.0.0')
        .option('-j, --join <value>', 'join game')
        .option('-n, --nick <value>', 'nick name')
        .option('-u, --update <value>', 'The account to update')
        .option('-m, --main-net', 'Use Main Net instead of Test Net')
        .parse(process.argv);

    var testNet = !program.mainNet;
    
    btclient = new bitcoin.Client({
        host: '127.0.0.1',
        port: 8332,
        user: 'username',
        pass: 'jsdjalsdjlkasjdlkasjdlajslkdjsaldjksjdlasjdlajsdlajsldkjasldjlkasjlkdjl1jj1j1j1j!!',
        timeout: 20000
    });

    dbh = redis.createClient(redisDsn);
    dbh.on("error", function (err) {
        console.log("Error " + err);
    });
    dbh.auth(redisPassword, function (err) {
        if (err) console.log(err);
        else {
            if (program.join) {
                var gameName = program.join;
                var playerName = program.nick;
                joinGame(gameName, playerName).finally(function () {
                    console.log("Done.");
                    dbh.quit();
                });
            }
            else if (program.update) {
                var account = program.update;
                update(account).finally(function () {
                    console.log("Update done.");
                    dbh.quit();
                });
            }
            else {
                console.log("WHAT DO YOU WANT!!!!");
                dbh.quit();
            }
        }
    });
    
}

function update(gameName) {
    var deferred = Q.defer();
    // for each player
        // if address is not present, join game
    
    dbh.smembers("players", function(error, playersSet){
        if (onResponse(error)) {
            var qs = [];
            for (var i = 0; i < playersSet.length; i++) {
                var playerKey = playersSet[i];
                var d2 = Q.defer();
                qs.push(d2.promise);
                dbh.get("players:"+playerKey, (function(d2){return function (error, playerObject) { // NOTE im immediately binding d2 to the context of the function
                    if (onResponse(error)) {
                        if (playerObject) {
                            playerObject = JSON.parse(playerObject);
                            if (!playerObject.address) {
                                joinGame(gameName, playerObject.name).then(function () {
                                    console.log("joined by update " + playerObject.name);
                                    playerObject.amount = 0;
                                    updateBalanceAndResolve(playerObject);
                                }, d2.reject); 
                            }
                            else {
                                updateBalanceAndResolve(playerObject);
                            }
                        }
                    }
                    else d2.reject();
                    
                    function updateBalanceAndResolve(playerObject) {
                        console.log(playerObject.name + " is fully joined.");
                        playerObject.amount = -1;
                        btclient.getReceivedByAddress(playerObject.address, 0, function (error, resAmount) {
                            if ("getReceivedByAddress ", error) console.log(error);
                            if(!error) {
                                playerObject.amount = resAmount;
                                console.log(playerObject.name + " has "+ resAmount);
                                savePlayerObj(playerObject).then(d2.resolve, d2.reject);
                            }
                            else d2.reject();
                        });
                    }
                }})(d2));
            }
            
            Q.all(qs).then(deferred.resolve, deferred.reject);
        }
    });

    function savePlayerObj(playerObject) {
        var deferred2 = Q.defer();
        dbh.set( 'players:' + playerObject.name, JSON.stringify(playerObject), function (err) {
            if (err) {
                deferred2.reject(err);
            }
            else {
                deferred2.resolve();
            }
        });
        return deferred2.promise;
    }
    
    function onResponse(error) {
        if (error) {
            console.log(error);
            deferred.reject();
        }
        return !error;
    }
    
    return deferred.promise;
}

function joinGame(gameName, playerName) {
    var deferred = Q.defer();
    
    var account = gameName || "game_" + (new Date().getTime());
    if (!gameName) {
        console.log("new game name: "+account);
    }
    
    // pyramid of doom ahead :)
    
    //create account
    btclient.getAccountAddress(account, function(err, firstAddress) {
        if (err) return console.log(err);
        else {
                   
            // game exists, now add a player
            
            btclient.getNewAddress(account, function (err, newAddressForPlayer) {
                if (err) onError(err);
                else {
                    // add player
                    dbh.sadd('players', playerName, function (err) {
                        if (err) onError(err);
                        else {
                            dbh.set('players:' + playerName, JSON.stringify({
                                name: playerName,
                                address: newAddressForPlayer,
                            }), function (err) {
                                if (err) onError(err);
                                else {
                                    console.log(playerName + " joined game " + gameName);
                                    deferred.resolve();
                                }
                            });
                            
                        }
                    });
                }       
            });
        }
    });

    function onError(error) {
        console.log(error);
        deferred.reject();
    }
    
    return deferred.promise;
}



