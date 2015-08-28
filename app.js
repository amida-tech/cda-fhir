/// <reference path="./typings/node/node.d.ts"/>
/// <reference path="./typings/mocha/mocha.d.ts"/>
/// <reference path="./typings/lodash/lodash.d.ts" />

/**
 * CcdaParserStream usage example.
 */
"use strict";

var fs = require('fs');

var bbcms = require("./index");

console.time('--> CcdaParserStream');

var request = require('request');
var istream = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Vitera/Vitera_CCDA_SMART_Sample.xml');

//var istream = fs.createReadStream(__dirname + '/test/artifacts/bluebutton-01-original.xml', 'utf-8');

istream
    .pipe(new bbcms.CcdaParserStream())
    .on('data', function (data) {

        console.log(JSON.stringify(data, null, '  '));
    })
    .on('finish', function () {
        console.timeEnd('--> CcdaParserStream');
    })
    .on('error', function (error) {
        console.log(error);
    });
