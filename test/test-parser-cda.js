/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/mocha/mocha.d.ts"/>
"use strict";

var expect = require('chai').expect;
var fs = require('fs');

var bbcms = require("../index");

describe('CCDA parser test', function () {

    it('"bluebutton-01-original.xml" as input', function (done) {

        var istream = fs.createReadStream(__dirname + '/artifacts/bluebutton-01-original.xml', 'utf-8');
        expect(istream).to.exist;

        istream
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/bluebutton-01-original.json', JSON.stringify(data, null, '  '));

                var gold = fs.readFileSync(__dirname + '/artifacts/bluebutton-01-original-gold.json', 'utf-8');
                expect(JSON.parse(gold)).to.eql(data);

            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('"Vitera_CCDA_SMART_Sample.xml" as input', function (done) {

        var request = require('request');
        var data = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Vitera/Vitera_CCDA_SMART_Sample.xml');

        data
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/Vitera_CCDA_SMART_Sample.json', JSON.stringify(data, null, '  '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('"Enterprise EHR/b2 Adam Everyman ToC.xml" as input', function (done) {

        var request = require('request');
        var data = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Allscripts%20Samples/Enterprise%20EHR/b2%20Adam%20Everyman%20ToC.xml');

        data
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/b2_Adam_Everyman_ToC.json', JSON.stringify(data, null, '  '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('"170.314(e)(2)AMB_SummaryOfCare CED Type.xml" as input', function (done) {

        var request = require('request');
        var data = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Allscripts%20Samples/Internal%20Test%20with%20MU%202%20data/170.314(e)(2)AMB_SummaryOfCare%20CED%20Type.xml');

        data
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/170_314_e__2_AMB_SummaryOfCare_CED_Type.json', JSON.stringify(data, null, '  '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('"CCD.sample.xml" as input', function (done) {

        var request = require('request');
        var data = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/HL7%20Samples/CCD.sample.xml');

        data
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/CCD_sample.json', JSON.stringify(data, null, '  '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('"CCDA_CCD_b1_Ambulatory_v2.xml" as input', function (done) {

        var request = require('request');
        var data = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/NIST%20Samples/CCDA_CCD_b1_Ambulatory_v2.xml');

        data
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                expect(data).to.exist;
                fs.writeFile(__dirname + '/artifacts/CCDA_CCD_b1_Ambulatory_v2.json', JSON.stringify(data, null, '  '));
            })
            .on('finish', function () {
                done();
            })
            .on('error', function (error) {
                done(error);
            });

    });

    it('buggy input', function (done) {
        var istream = fs.createReadStream(__dirname + '/test-parser-cda.js', 'utf-8');

        expect(istream).to.exist;

        istream
            .pipe(new bbcms.CcdaParserStream())
            .on('data', function (data) {
                if (!(data instanceof Error)) {
                    done('Error object expected');
                } else {
                    done();
                }
            })
            .on('finish', function () {})
            .on('error', function (error) {});

    });
});
