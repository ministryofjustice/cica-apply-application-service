'use strict';

const fs = require('fs');
const {GetObjectCommand, PutObjectCommand, S3Client} = require('@aws-sdk/client-s3');
const logger = require('../logging/logger');

/** Returns S3 Service object with functions to get objects from an S3 bucket and put objects in an S3 bucket */

function createS3Service() {
    /* istanbul ignore next */

    const s3client = new S3Client({
        region: 'eu-west-2',
        endpoint: process.env.NODE_ENV === 'local' ? 'http://localhost:4566' : undefined,
        forcePathStyle: process.env.NODE_ENV === 'local' ? true : undefined
    });

    /**
     * Gets a JSON object with a key that matches the given key from a given S3 bucket
     * @param {string} bucket - The bucket to get the object from
     * @param {string} key - The key to match with a json in the bucket
     * @returns JSON object from bucket with key matching given key
     */
    async function getFromS3(bucket, key) {
        // validates that the S3 response is a JSON
        function validateS3Response(response) {
            if (response.ContentType !== 'application/json') {
                throw new Error(`${response.ContentType} content type is not supported`);
            } else {
                logger.info('File retrieved from S3 is valid');
            }
        }
        logger.info(process.env.KMS_KEY);
        const content = {
            Bucket: bucket,
            Key: `${key}`,
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: process.env.KMS_KEY
        };

        try {
            logger.info('Getting from S3');
            const response = await s3client.send(new GetObjectCommand(content));
            logger.info('Got from S3');
            validateS3Response(response);
            const str = await response.Body.transformToString();
            const json = JSON.parse(str);
            return json;
        } catch (err) {
            logger.error(err);
            throw err;
        }
    }

    /**
     * Puts given pdf in a given S3 bucket
     * @param {string} bucket - The bucket to put the pdf in
     * @param {string} object  - The name of the object to be put into S3
     * @param {string} key - The key to be put in S3
     */
    async function putInS3(bucket, object, key) {
        return new Promise((res, rej) => {
            logger.info('Putting in S3');
            fs.readFile(`./${object}`, async function(error, file) {
                if (error) {
                    logger.error(error);
                    rej(error);
                }

                const splitString = object.split('.');
                let contentType = splitString[splitString.length - 1];
                if (contentType === 'pdf') {
                    contentType = 'application/pdf';
                } else if (contentType === 'json') {
                    contentType = 'application/json';
                } else {
                    const unsupportedFileError = new Error('Unsupported file type');
                    logger.error(unsupportedFileError);
                    rej(unsupportedFileError);
                }

                // for some reason when running locally, the key is expected to be `bucket/key`
                // but when running in production, it is expected to be just `key`
                const s3Key = process.env.NODE_ENV === 'local' ? `${bucket}/${key}` : key;
                const command = new PutObjectCommand({
                    Bucket: bucket,
                    Key: s3Key,
                    Body: file,
                    ContentType: contentType,
                    ServerSideEncryption: 'aws:kms',
                    SSEKMSKeyId: process.env.KMS_KEY
                });

                try {
                    const response = await s3client.send(command);
                    res(response);
                } catch (err) {
                    logger.error(err);
                    rej(err);
                }
            });
        });
    }

    return Object.freeze({
        getFromS3,
        putInS3
    });
}

module.exports = createS3Service;
