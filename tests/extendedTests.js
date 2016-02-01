'use strict';

// Helper methods for extended tests
var wget = require('wget');
var fs = require('fs');
var Promise = require('bluebird');


// Test files directory
var DATA_DIR = __dirname+'/extended_tests';
var DIR1 = 'linux-3.0';
var DIR2 = 'linux-4.0';

var install, download;

var createPreconditions = function() {
    if(!fs.existsSync(DATA_DIR)){
        fs.mkdirSync(DATA_DIR);
    }
    return Promise.resolve().then(function(){
        var promises = [];
        if(!fs.existsSync(DATA_DIR+'/'+DIR1)){
            promises.push(install(DIR1));
        }
        if(!fs.existsSync(DATA_DIR+'/'+DIR2)){
            promises.push(install(DIR2));
        }
        return Promise.all(promises);
    });
};

install = function(dirName){
    var archName = dirName+'.tar.gz',
    url = 'https://www.kernel.org/pub/linux/kernel/v4.x/'+archName;
    console.log(url);
    if(fs.existsSync(url, DATA_DIR+'/'+archName)){
        return Promise.resolve();
    }
    return download(url, DATA_DIR+'/'+archName);
};

download = function(src, output){
    return new Promise(function(resolve, reject){
        var download = wget.download(src, output);
        download.on('end', function(output){
            resolve(output);
        });
        download.on('error', function(err){
            reject(err);
        });
    });
};



module.exports = {
    createPreconditions: createPreconditions,
    DATA_DIR: DATA_DIR
};


install(DIR1).then(function(){console.log('READY');}, function(error){console.log('ERROR: '+error);});
