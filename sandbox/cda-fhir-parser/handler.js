'use strict'
// const moment = require('moment');
const  { transformCDAtoFHIR } = require('./');
const s3 = require('../utils/aws/s3');

async function handler(event, context, callback) {
    // const batchId = moment().format('MMMM-Do-YYYY-h-mm-ss-SSS-a');
    const { inputBucket, outputBucket, startIndx, endIndx, patientId } = event;
    const s3Files = await s3.listObjects(inputBucket); 
    const fileNames = s3Files.slice(startIndx, endIndx);
    const promises = fileNames.map(async fileName => {
        let stream = s3.getObjectStream(inputBucket, fileName);
        let bundle = await transformCDAtoFHIR(stream, patientId);
        let fhirFileName = `${fileName}.json`;

        return ({
            fileName:fhirFileName,
            bundle
        })
    });

    let bundles = await Promise.all(promises)
    bundles.forEach( obj => {
        s3.putObject(outputBucket, obj.fileName, obj.bundle)
    })
    
    return;
}

module.exports = {
    handler
}