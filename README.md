# cda-fhir
Consolidated CDA (C-CDA) to FHIR converter

Convert C-CDA xml to FHIR bundle

[![NPM](https://nodei.co/npm/cda-fhir.png)](https://nodei.co/npm/cda-fhir/)

[![Build Status](https://travis-ci.org/amida-tech/cda-fhir.svg)](https://travis-ci.org/amida-tech/cda-fhir) [![Coverage Status](https://coveralls.io/repos/amida-tech/cda-fhir/badge.svg?branch=master&service=github)](https://coveralls.io/github/amida-tech/cda-fhir?branch=master) [![Dependency Status](https://david-dm.org/amida-tech/cda-fhir.svg)](https://david-dm.org/amida-tech/cda-fhir)

Consolidated CDA (C-CDA)

This library provides the following functionality
- Parse XML document using [sax js](https://github.com/isaacs/sax-js) parser
- Generate set of resources conformant to [FHIR DSTU2](http://www.hl7.org/fhir/index.html) 

Usage example:

```javascript
'use strict';

var _ = require('lodash');

var bbcms = require('./index');

// Make it transactional bundle
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

var request = require('request');

// Get sample file from GitHub
var istream = request.get('https://raw.githubusercontent.com/chb/sample_ccdas/master/Vitera/Vitera_CCDA_SMART_Sample.xml');

istream
    .pipe(new bbcms.CcdaParserStream("test" /* PatientId */))
    .on('data', function (data) {
        var bundle = JSON.stringify(makeTransactionalBundle(data), null, '  ');
		
        console.log(bundle); // Result bundle
		
    })
    .on('error', function (error) {
        console.log(error);
    });
```
## License

Licensed under [Apache 2.0](./LICENSE)
