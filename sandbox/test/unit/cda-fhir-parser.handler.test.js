'use strict';
const _ = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { getSingleFileContents, writeFile } = require('../../utils/fileio');
const path = require('path')

chai.use(chaiAsPromised);


describe('CDA->FHIR parser lambda', async () => {
    jest.mock('../../utils/aws/s3');
    let s3Mocks = require('../../utils/aws/s3');
    test('handler transforms data as expected', async () => {  
        let hanahBanana = await getSingleFileContents(path.join(__dirname,'../data/CCDA/HannahBanana_EpicCCD.xml'));

        const MOCK_BUCKET_INFO = [
            {
                bucket:'mockInputBucket',
                key: 'HannahBanana_EpicCCD.xml',
                object: hanahBanana
            },
        ];
        s3Mocks.__setMockObjects(MOCK_BUCKET_INFO);
       
        const { handler } = require('../../cda-fhir-parser/handler');

        await handler({
            inputBucket:"mockInputBucket",
            outputBucket: "mockOutputBucket",
            startIndx:0,
            endIndx:3,
            patientId: 1
        }, null, () => {});
        
        expect(s3Mocks.listObjects).toBeCalledTimes(1)
        expect(s3Mocks.listObjects).toBeCalledWith('mockInputBucket')
        expect(s3Mocks.getObjectStream).toBeCalledTimes(1)
        expect(s3Mocks.getObjectStream.mock.calls[0]).toEqual(['mockInputBucket','HannahBanana_EpicCCD.xml'])
        expect(s3Mocks.putObject.mock.calls[0][2]).toBeDefined();
        const output = JSON.parse(s3Mocks.putObject.mock.calls[0][2]);
        await writeFile(path.join(__dirname, '../data/CCDA/HannahBanana_output.json'), JSON.stringify(output, null, 2));

    });
})
