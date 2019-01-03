'use strict';

const _ = require('lodash');
const cdaToFhir = require('../../lib/parser');

// Make it transactional bundle
const __makeTransactionalBundle = function (bundle, base, patientId) {
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

async function transformCDAtoFHIR(stream, patientId) {
    return new Promise((resolve, reject) => {
        stream
        .pipe(new cdaToFhir.CcdaParserStream())
        .on('data', function (data) {
            let bundle = JSON.stringify(__makeTransactionalBundle(data, "base", patientId));
            resolve(bundle);
        })
        .on('error', function (error) {
            reject(error);
        });
    })
   
}

module.exports = {
    transformCDAtoFHIR
}