'use strict';

const AWS = require('aws-sdk');
const _ = require('lodash');
const path = require('path');
const config = require('../../config');


let awsConfig = {
    region: config.awsRegion,
    apiVersion: config.s3.apiVersion,
}
if(_.has(config, "s3.url")) {
    awsConfig.endpoint = new AWS.Endpoint(`${config.s3.url}`);
} 
const s3 = new AWS.S3(awsConfig);

async function upload(uploadParams) {
    return new Promise((resolve, reject) => {
        s3.upload(uploadParams, (err, data) => {
            if (err) {
                reject(err);
            } if (data) {
                resolve(data);
            }
        });
    });
}

async function putObject(Bucket, Key, Body) {
    return new Promise((resolve, reject) => {
        s3.putObject({ Bucket, Key, Body }, (err, data) => {
            if (err) {
                reject(err);
            } if (data) {
                resolve(data);
            }
        });
    });
}

async function listObjects(Bucket) {
    const params = {
        Bucket,
    };
    return new Promise((resolve, reject) => {
        s3.listObjects(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const keys = data.Contents.map(content => content.Key);
                resolve(keys);
            }
        });
    });
}

async function getObject(Bucket, Key) {
    const params = { Bucket, Key };
    return new Promise((resolve, reject) => {
        let chunks = [];
        s3.getObject(params, (err, data) => {
            if (err) {
                reject(err);
            } if (data) {
                data.createReadStream()
                .on('data', chunk => chunks.push(chunk.toString()))
                .on('end', () => {
                    resolve(chunks.join(''))
                });
            }
        })
    });
}

async function getObjectStream(Bucket, Key) {
    const params = { Bucket, Key };
    return new Promise((resolve, reject) => {
        s3.getObject(params, (err, data) => {
            if (err) {
                reject(err);
            } if (data) {
                resolve(data.createReadStream())      
            }
        })
    });
}

async function downloadBucketFiles(bucket, saveDir) {
    const files = await listObjects(bucket);
    const fileDownloadPromises = [];
    files.forEach((file) => {
        const savePath = path.resolve(saveDir, file);
        fileDownloadPromises.push(getObject(savePath, bucket, file));
    });
    return Promise.all(fileDownloadPromises);
}

async function createBucket(Bucket) {
    return new Promise((resolve, reject) => {
        s3.createBucket({ Bucket }, (err, data) => {
            if (err) {
                reject(err);
            } if (data) {
                resolve(data);
            }
        });
    });
   
}



module.exports = {
    upload,
    getObject,
    getObjectStream,
    listObjects,
    downloadBucketFiles,
    createBucket,
    putObject
};
