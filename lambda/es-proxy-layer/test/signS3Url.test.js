/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const presigner = require('@aws-sdk/s3-request-presigner'); // eslint-disable-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const customSdkConfig = require('sdk-config/customSdkConfig');
const { signS3URL } = require('../lib/signS3URL');
const _ = require('lodash');

jest.mock('qnabot/settings');
jest.mock('qnabot/logging');
jest.mock('@aws-sdk/s3-request-presigner');
presigner.getSignedUrl.mockImplementation(() => {
    return 'https://signedurl.s3.amazonaws.com/'
});

const url = 'https://qna.s3.amazonaws.com/test.json';
const mockCb = jest.fn();

describe('signS3URL', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('evaluate signS3URL condition', async () => {
        signS3URL(url, 300, (url) => {
            expect(url).toBe("https://signedurl.s3.amazonaws.com/");
            expect(presigner.getSignedUrl).toBeCalledTimes(1);
        });
    });

    test('evaluate signS3URL condition with non-s3 url', async () => {
        signS3URL('https://s3.amazonaws.com/test.json', 300, (url) => {
            expect(url).toBe("https://s3.amazonaws.com/test.json");
            expect(presigner.getSignedUrl).toBeCalledTimes(0);
        });
    });

});



