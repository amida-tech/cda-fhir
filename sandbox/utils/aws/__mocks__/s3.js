// __mocks__/s3.js
'use strict'
const Readable = require('stream').Readable;
const s3 = jest.genMockFromModule('../s3');
const _ = require('lodash');
let mockBuckets = Object.create(null);

const __setMockObjects = (mockObjects) => {
  mockBuckets = Object.create(null);

  mockObjects.forEach( ({bucket, key, object}) => {
    //purposefully repeating putObject functionality b/c
    //using that mock to stay DRY will add to spy call count.
    if (!mockBuckets[bucket]) {
      mockBuckets[bucket] = {};
    }
    mockBuckets[bucket][key] = object
  })
}

const __resetMockObjects = () => {
  mockBuckets = Object.create(null)
}

const getObjectStreamMock = jest.fn((Bucket, Key) => {
  const mockStream = new Readable();
  mockStream._read = () => {};
  mockStream.push(mockBuckets[Bucket][Key].contents);
  mockStream.push(null);
  return mockStream;
});

const getObjectMock = jest.fn((Bucket, Key) => {
  return mockBuckets[Bucket][Key]
});
const listObjectsMock = jest.fn(Bucket => _.map(mockBuckets[Bucket],(obj, key) => key));

const putObjectMock = jest.fn((bucket, key, object) => {
  if (!mockBuckets[bucket]) {
    mockBuckets[bucket] = {};
  }
  mockBuckets[bucket][key] = object
});


s3.__setMockObjects = __setMockObjects;
s3.__resetMockObjects = __resetMockObjects;
s3.listObjects = listObjectsMock;
s3.getObjectStream = getObjectStreamMock;
s3.getObject = getObjectMock;
s3.putObject = putObjectMock;


module.exports = s3;