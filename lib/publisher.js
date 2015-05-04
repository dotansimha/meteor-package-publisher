var BowerParser = require('./parsers/bowerParser');
var _ = require('lodash');
var Q = require('Q');
var fs = require('fs');
var cp = require('child_process');

var MeteorPublisher = function() {
    console.log('Hi, I am the Meteor packages publisher. All you have to do is sit back and let the evening go.');
};

MeteorPublisher.prototype.analyse = function(json) {
    if (json.source.type === 'bower') {
        return new BowerParser();
    }
};

MeteorPublisher.prototype.setSource = function(source) {
    this._source = source;
};

MeteorPublisher.prototype.setDestination = function(dest) {
    this._destination = dest;
};

MeteorPublisher.prototype.verifyDepsCount = function() {
    if (this._destination.use && this._destination.use.length > 0 && this._source.depsCount > 0) {
        if (this._destination.use.length < this._source.depsCount) {
            console.info('Source dependencies: ', _.keys(this._source.raw).join(', '));
            console.info('Destination dependencies: ', _.pluck(this._destination.use, 'name').join(', '));

            throw 'The dependencies count for your source does not match the destination.';
        }
    }
};

MeteorPublisher.prototype.verifyVersion = function() {
    if (this._source._version !== this._destination._version) {
        console.info('Source version: ', _.keys(this._source.raw).join(', '));
        console.info('Destination version: ', _.pluck(this._destination.use, 'name').join(', '));

        throw 'The version for your source does not match the destination.';
    }
};

MeteorPublisher.prototype.verify = function() {
    if (!this._source || !this._destination) {
        throw 'Invalid source and destination information provided!';
    }
};

MeteorPublisher.prototype.test = function() {
    console.info('Check for constrains and dependencies...');
    this.verify();
    this.verifyDepsCount();
    this.verifyVersion();
};

MeteorPublisher.prototype.createPackageFile = function() {
    var that = this;

    console.info('Reading and modifying base Package.js file...');

    var deferred = Q.defer();
    var readFile = function(cb) {
        fs.readFile('./lib/base_package.txt', 'utf8', function (err, data) {
            if (err) {
                console.log('Error: ' + err);
                deferred.reject(err);
                return;
            }

            cb(data);
        });
    };

    readFile(function(fileString) {
        // Package describe
        fileString = fileString.replace('ORGANIZATION_NAME', that._destination.atmosphereOrganizationName);
        fileString = fileString.replace('PACKAGE_NAME', that._destination.atmospherePackageName);
        fileString = fileString.replace('VERSION', that._destination.version || that._source.version);
        fileString = fileString.replace('SUMMARY_STRING', that._destination.summary || '');
        fileString = fileString.replace('GIT_LINK', that._destination.git || '');
        fileString = fileString.replace('DOC_FILENAME', that._destination.documentation ? '\'' + that._destination.documentation + '\'' : 'null');

        // Package onUse
        fileString = fileString.replace('VERSIONS_FROM', that._destination.versionsFrom);

        // Package dependencies (use function)
        var handleSectionWithPlatforms = function(arr, addCb) {
            var returnString = '';

            _.forEach(arr, function(value) {
                returnString += addCb(value.name, JSON.stringify(value.platforms), value.weak);
            });

            return returnString;
        };

        fileString = fileString.replace('DEPS_SECTION', handleSectionWithPlatforms(that._destination.use, function(name, platforms, weak) {
            var ret = "api.use('" + name + "', " + platforms;

            if (weak) {
                ret += ", {weak: true}";
            }

            ret += ");\n";

            return ret;
        }));

        fileString = fileString.replace('ADD_FILES_SECTION', handleSectionWithPlatforms(that._destination.filesToAdd, function(name, platforms) {
            return "api.addFiles('" + name + "', " + platforms + ");\n";
        }));

        fileString = fileString.replace('EXPORTS_SECTION', handleSectionWithPlatforms(that._destination.export, function(name, platforms) {
            return "api.export('" + name + "');\n";
        }));

        console.info('File modified, now just need to write it...');

        var packageFile = that._source.directory + '/package.js';

        fs.writeFile(packageFile, fileString, function (err) {
            if (err) {
                deferred.reject(err);

                return console.log(err);
            }

            console.log('Package file created on: ', packageFile);

            deferred.resolve(packageFile, fileString);
        });
    });

    return deferred.promise;
};

MeteorPublisher.prototype.publish = function(create, d) {
    var that = this;
    var deferred = d || Q.defer();

    var command = 'meteor publish ' + (create ? ' --create' : '');
    console.info('Now just running', command);

    var childProcess = cp.exec(command, {cwd: this._source.directory}, function() {});

    childProcess.stdout.on('data', function (d) {
        console.log(d);
    });

    childProcess.stderr.on('data', function (d) {
        if (d.indexOf('log in') !== -1) {
            throw 'Please login to meteor and then use this tool!';
        }
        else if (d.indexOf('There is no package') !== -1) {
            console.info('Package does not exists yet, running again with `create` flag.');
            return that.publish(true, deferred);
        }
        else if(d.indexOf('Version already exists') !== -1) {
            console.info('Version already exists...');
            deferred.resolve();
        }
        else {
            console.log(d);
        }
    });

    childProcess.on('error', function (err) {
        console.error('Failed with:', err);
    });

    childProcess.on('exit', function(code) {
        if (code === 0) {
            console.log('Publish is done! your package should be available in: ', 'https://atmospherejs.com/' + that._destination.atmosphereOrganizationName + '/' + that._destination.atmospherePackageName);
            deferred.resolve();
        }
    });

    return deferred.promise;
};

module.exports = MeteorPublisher;