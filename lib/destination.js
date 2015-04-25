var _ = require('lodash');

var destination = function(jsonData) {
    _.merge(this, jsonData);
};

module.exports = destination;