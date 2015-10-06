/// <reference path="./typings/node/node.d.ts"/>
/// <reference path="./typings/mocha/mocha.d.ts"/>
/// <reference path="./typings/lodash/lodash.d.ts" />

/**
 * CcdaParserStream usage example.
 */
"use strict";

var fs = require('fs');
var http = require('http');
var _ = require('lodash');

var bbcms = require("./index");

var makeTransactionalBundle = function (bundle, base, patientId) {
    _.each(bundle.entry, function (value) {
        value.request = {
            'method': (value.resource.resourceType === 'Patient') ? 'PUT' : 'POST',
            'url': (value.resource.resourceType === 'Patient') ? 'Patient/' + patientId : value.resource.resourceType
        };
        value.base = base;
    });
    bundle.type = 'transaction';
    return bundle;
};

console.time('--> CcdaParserStream');

var request = require('request');
//var istream = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Vitera/Vitera_CCDA_SMART_Sample.xml');

var istream = fs.createReadStream(__dirname + '/test/artifacts/bluebutton-01-original.xml', 'utf-8');

istream
    .pipe(new bbcms.CcdaParserStream("test"))
    .on('data', function (data) {
        var bundle = JSON.stringify(makeTransactionalBundle(data), null, '  ');
        console.log(bundle);
        var req = http.request({
                hostname: 'localhost',
                port: 8080,
                path: '/fhir/baseDstu2',
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Content-Length': bundle.length
                }
            },
            function (res) {
                var response = '';
                console.log('STATUS: ' + res.statusCode);
                console.log('HEADERS: ' + JSON.stringify(res.headers));
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    console.log('BODY: ' + chunk);
                    response = response + chunk;
                });
                res.on('end', function () {
                    console.log('No more data in response.');
                    var zipped = _.zip(data.entry, JSON.parse(response).entry);
                    console.log(zipped);

                    zipped.forEach(function (element) {
                        var result2 = '';
                        var req = http.request({
                            hostname: 'localhost',
                            port: 8080,
                            path: '/fhir/baseDstu2/' + element[1].response.location,
                            method: 'GET',
                        }, function (res) {
                            res.setEncoding('utf8');
                            res.on('data', function (chunk) {
                                    //console.log('BODY2: ' + chunk);
                                    result2 = result2 + chunk;
                                })
                                .on('end', function () {
                                    var resource = JSON.parse(result2);
                                    var comparator = function (l, r, propn) {
                                        if (_.isNumber(l)) {
                                            return;
                                        }
                                        if (_.isString(l)) {
                                            return;
                                        }
                                        if (_.isBoolean(l)) {
                                            return;
                                        }
                                        if (_.isArray(l) && _.isArray(r)) {
                                            if (l.length !== r.length) {
                                                console.log('!-------- Array length differ %s', propn);
                                            }
                                            for (var i = 0; i < l.lenght && i < r.length; i++) {
                                                comparator(l[i], r[i], propn);
                                            }
                                        }

                                        for (var prop in l) {
                                            if (l.hasOwnProperty(prop)) {
                                                if (!r.hasOwnProperty(prop)) {
                                                    console.log('!-------- Missed prop ' + prop);
                                                } else {
                                                    comparator(l[prop], r[prop], prop);
                                                }
                                            }
                                        }
                                    };
                                    console.log('compare:\n %j \n %j', element[0].resource, resource);
                                    comparator(element[0].resource, resource);
                                });
                        });
                        req.end();
                    });
                    //process.exit();
                });
            });
        req.write(bundle);
        req.end();
    })
    .on('finish', function () {

    })
    .on('error', function (error) {
        console.log(error);
    });
