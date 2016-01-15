var bitcoin = require('bitcoin');
var program = require("commander");
var redis = require("redis");

var dbh = null;
var btclient = null;
var redisPassword = "n9ip3fwvWOwzu4wi";
var redisDsn = "redis:pub-redis-17864.dal-05.1.sl.garantiadata.com:17864";

runProgram();


//commands:

function runProgram() {
    program.version('1.0.0')
        .option('-c, --create <n>', 'Create game, with threshold', parseFloat)
        .option('-u, --update <value>', 'The account to update')
        //.option('-m, --main-net', 'Use Main Net instead of Test Net')
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
            if (program.create) {
                var threshold = program.create;
                startGame(threshold, testNet);
            }
            else if (program.update) {
                var account = program.update;
                update(account);
            }
            else {
                console.log("WHAT DO YOU WANT!!!!");
            }
        }
    });
    
}


function update(account) {
    
    // this is a pyramid of doom :) Don't attempt to understand it.
    
    btclient.listReceivedByAddress(0, false, function(err, result) {
        if (err) return console.log(err);
        else {
            
            dbh.get("target_address", function (err, gameAddressResult) {
                if (err) console.log(err);
                else {
                    console.log("gameaddr " + gameAddressResult);

                    // here goes
    
                    for (var i = 0; i < result.length; i++) {
                        var row = result[i];
                        var address = row.address;
                        if (address == gameAddressResult) {
                            console.log(i, address);
                            var addressPayMap = {};
    
                            for (var j = 0; j < row.txids.length; j++) {
                                var txid = row.txids[j];
                                btclient.getTransaction(txid, function(err, txDetailsResult) {
                                    console.log(txDetailsResult)
                                    if (err) console.log(err);
                                    else {
                                        for (var k = 0; k < txDetailsResult.details.length; k++) {
                                            var tx = txDetailsResult.details[k];
                                            if (tx.category == "send") {
                                                if (!addressPayMap[tx.address]) {
                                                    addressPayMap[tx.address] = 0;    
                                                }
                                                addressPayMap[tx.address] += tx.amount;
                                            }  
                                        }
                                        console.log("Result after processing tx:");
                                        console.log(addressPayMap);
                                    }
                                });
                            }
                            
                            
                        }
                    }
                    
                    dbh.quit();
                }
            });
        }
    });
}

function startGame(threshold, testNet) {
    console.log("Starting game. Threshold: " + threshold);
    
    var account = "game_" + (new Date().getTime());
     //create account
    btclient.getAccountAddress(account, function(err, gameAddress){
        if (err) return console.log(err);
        else {
            console.log("Account: " + account);
            console.log("Address: " + gameAddress);
            
            dbh.set("target_address", gameAddress, redis.print);
            dbh.set("threshold", threshold, redis.print);
            dbh.quit();
        }        
    });
}


