/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/mocha/mocha.d.ts"/>
"use strict";

var expect = require('chai').expect;
var fs = require('fs');

var bbcms = require("../index");

describe('parser.js', function () {
    it('CCDA parser test', function (done) {
        var istream = fs.createReadStream(__dirname + '/artifacts/bluebutton-01-original.xml', 'utf-8');

        expect(istream).to.exist;

        istream
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/bluebutton-01-original.json', JSON.stringify(data, null, '    '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

});
