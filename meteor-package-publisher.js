var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var MeteorPublisher = require('./lib/publisher');

var packageInfoFilename = argv._[0];
var publisher = new MeteorPublisher();

fs.readFile(packageInfoFilename, 'utf8', function (err, data) {
    if (err) {
        console.log('Error: ' + err);
        return;
    }

    data = JSON.parse(data);

    publisher.setDestination(data.destination);

    var sourceParser = publisher.analyse(data);

    sourceParser.clean();

    sourceParser.load(data.source.name, data.source.version).then(function(sourceData) {
        publisher.setSource(sourceData);

        try {
            publisher.test();
            publisher.createPackageFile().then(function() {
                publisher.publish().then(function() {
                    publisher.clean();
                })
            });
        }
        catch (error) {
            console.error(error);
        }
    });
});