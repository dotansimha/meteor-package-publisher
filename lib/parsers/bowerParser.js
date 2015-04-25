var bowerApi = require('bower');
var source = require('../source');
var _ = require('lodash');
var rimraf = require('rimraf');
var Q = require('Q');

var BowerParser = function() {
    console.log('bowerParser initialized!');
};

BowerParser.prototype.clean = function() {
    console.log('bowerParser cleaning bower_components');

    rimraf.sync('./bower_components', function(error){
        if (error !== null) {
            console.error('bower clean error ', error);
        }
    });
};

BowerParser.prototype.load = function(name, version) {
    var deferred = Q.defer();

    var installName = name;
    if (version) {
        installName = installName + '#' + version;
    }

    console.log('bowerParser looking for', installName);

    bowerApi.commands
        .install([installName], { save: false }, { })
        .on('end', function(installed) {
            if (installed[name]) {
                var s = new source();
                s.directory = installed[name].canonicalDir;
                delete installed[name];
                s.depsCount = _.keys(installed).length;
                s.raw = installed;
                s.version = version;

                deferred.resolve(s);
            }
            else {
                deferred.reject();
            }
        });

    return deferred.promise;
};

module.exports = BowerParser;