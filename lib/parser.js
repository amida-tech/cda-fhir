"use strict";

var Transform = require("stream").Transform;
var util = require("util");
var _ = require("lodash");
var XmlStream = require("xml-stream");

/*function CdaParserStream() {
    Transform.call(this, {
        "objectMode": true
    }); // invoke Transform's constructor, expected result is object
}

util.inherits(CdaParserStream, Transform); // inherit Transform

CdaParserStream.prototype._transform = function (sourceXml, encoding, cb) {
    this.push(streamXml);
    cb();
};*/

function IntObjToFhirStream(baseUrl) {
    Transform.call(this, {
        "objectMode": true
    }); // invoke Transform's constructor, expected result is object

    this.bundle = {};
}

util.inherits(IntObjToFhirStream, Transform); // inherit Transform

IntObjToFhirStream.prototype._transform = function (sourceObj, encoding, cb) {
    this.push(sourceObj);
    cb();
};

module.exports.CdaParser = XmlStream;
module.exports.IntObjToFhirStream = IntObjToFhirStream;
