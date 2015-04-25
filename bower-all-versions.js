var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var MeteorPublisher = require('./lib/publisher');
var bowerApi = require('bower');
var _ = require('lodash');

var packageInfoFilename = argv._[0];


fs.readFile(packageInfoFilename, 'utf8', function (err, data) {
    if (err) {
        console.log('Error: ' + err);
        return;
    }

    data = JSON.parse(data);

    var runForVersion = function(versionArray, key) {
        if (!versionArray[key]) {
            console.info('done!');
            return;
        }
        data.source.version = versionArray[key];

        var publisher = new MeteorPublisher();
        publisher.setDestination(data.destination);

        var sourceParser = publisher.analyse(data);

        sourceParser.clean();

        sourceParser.load(data.source.name, data.source.version).then(function(sourceData) {
            publisher.setSource(sourceData);

            try {
                publisher.test();
                publisher.createPackageFile().then(function() {
                    publisher.publish().then(function() {
                        runForVersion(versionArray, key + 1);
                    })
                });
            }
            catch (error) {
                console.error(error);
            }
        });
    };

    bowerApi.commands.info(data.source.name, '')
        .on('end', function(info) {
            var versions = info.versions;
            runForVersion(versions, 0);
        });
});