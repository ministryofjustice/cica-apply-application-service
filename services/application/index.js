'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../logging/logger');
const createS3Service = require('../s3');
const createSqsService = require('../sqs');
const createPdfService = require('../pdf');

const applicationQueue = process.env.APPLICATION_QUEUE_ID;
const tempusQueue = process.env.TEMPUS_QUEUE_ID;
const bucket = process.env.S3_BUCKET;

/**
 * Extracts the S3 location as a string from the SQS message.
 * @param {string} message - The SQS message received.
 */
function parseJSONLocation(message) {
    const messageBody = JSON.parse(message.Body);
    const key = messageBody.applicationJSONDocumentSummaryKey;

    if (!key.endsWith('.json')) {
        throw new Error('Application JSON document location is not in a valid format (.json)');
    }

    return key;
}

/**
 * Extracts the questionnaireId from the SQS message body if present.
 * @param {object} message - The SQS message received.
 * @returns {string|null} The questionnaireId if present, otherwise null.
 */
function parseQuestionnaireId(message) {
    const messageBody = JSON.parse(message.Body);
    return messageBody.questionnaireId ?? null;
}

/**
 * Gets the full S3 URI of the split JSON file
 * @param {string} key - The original filename for the base JSON.
 */
function getSplitJsonFilename(key) {
    return `${path.parse(key).dir}/${path.parse(key).name}-split${path.parse(key).ext}`;
}

/**
 * Uses the case reference number from the application json to determine the upload
 * location of the generaed PDF summary form.
 * @param {string} applicationJson - The full application JSON from S3.
 */
function generatePDFLocation(applicationJson) {
    // Restructures case reference number to be - separated instead of \ separated.
    const refArr = applicationJson.meta.caseReference.split('\\');
    const refNumber = `${refArr[0]}-${refArr[refArr.length - 1]}`;

    return `${refNumber}/application-summary.pdf`;
}

/**
 * Generates, uploads and sends an associated SQS message for an application PDF summary
 * @param {obj} applicationJson - the application JSON data retrieved from S3
 * @param {string} jsonKey - the location of the application data in S3 to forward on to SQS
 * @param {string} temporaryLocation - a temporary local location to save the PDF to until it is uploaded
 */
async function processPdf(applicationJson, jsonKey, temporaryLocation) {
    const pdfService = createPdfService();
    const s3Service = createS3Service();

    // Generate the location to store the document in S3
    const pdfLocation = generatePDFLocation(applicationJson);

    const temporaryFileName = `${temporaryLocation}/${path.parse(jsonKey).name}.pdf`;

    // Generate the PDF
    await pdfService.writeJSONToPDF(applicationJson, temporaryFileName);

    // Upload the PDF document to S3
    await s3Service.putInS3(bucket, temporaryFileName, pdfLocation);

    // Delete the temporary file after upload
    fs.unlinkSync(temporaryFileName);

    return pdfLocation;
}

async function sendToTempus({
    pdfLocation,
    jsonKey,
    message,
    questionnaireId,
    caseReference,
    isSplitFuneralPDF = false
}) {
    if (JSON.parse(message.Body).regeneratePdf) {
        logger.info({questionnaireId, caseReference}, 'Skipping sending to Tempus.');
        return 'Skipped sending to Tempus';
    }

    const sqsService = createSqsService();

    // Write message to Tempus queue for further processing
    const sqsInput = {
        QueueUrl: tempusQueue
    };

    const sqsBody = JSON.stringify({
        applicationPDFDocumentSummaryKey: pdfLocation,
        applicationJSONDocumentSummaryKey: jsonKey,
        questionnaireId
    });

    if (isSplitFuneralPDF) {
        logger.info({questionnaireId}, 'Split funeral message sent to Tempus queue');
    } else {
        logger.info({questionnaireId, caseReference}, 'Sending message to Tempus queue');
    }
    return sqsService.sendSQS(sqsInput, sqsBody);
}

/**
 * For the purposes of split fatal applications, this duplicates the original JSON
 * updates the caseReference and splitFuneral metadata
 * and saves this file to a temporary location
 * @param {json} applicationJson - the application JSON data retrieved from S3
 * @param {string} temporaryLocation - a temporary local location to save the PDF to until it is uploaded
 */
async function duplicateJson(applicationJson, temporaryLocation) {
    applicationJson.meta.caseReference = applicationJson.meta.funeralReference;
    applicationJson.meta.splitFuneral = true;

    return new Promise((resolve, reject) => {
        fs.writeFile(temporaryLocation, JSON.stringify(applicationJson), err => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Processes a json message through the application service, prodcuing the pdf and
 *  sending a message to the Tempus queue when done.
 * @param {string} message - The message picked up from the queue
 */
async function processMessage(message) {
    // Initialise services
    const s3Service = createS3Service();
    const sqsService = createSqsService();

    // Set the location to temporarily store the generated document
    const temporaryLocation = './temp';
    if (!fs.existsSync(temporaryLocation)) {
        fs.mkdirSync(temporaryLocation);
    }

    // Retrieve the JSON data from S3
    const jsonKey = parseJSONLocation(message);
    const questionnaireId = parseQuestionnaireId(message);
    const applicationJson = await s3Service.getFromS3(bucket, jsonKey);
    const {caseReference} = applicationJson.meta;

    logger.info({questionnaireId, caseReference}, 'Processing application message');

    const pdfLocation = await processPdf(applicationJson, jsonKey, temporaryLocation);
    logger.info({questionnaireId, caseReference, pdfLocation}, 'PDF generated and uploaded to S3');

    // Send message to Tempus queue
    await sendToTempus({
        pdfLocation,
        jsonKey,
        message,
        questionnaireId,
        caseReference
    });

    // If there is a secondary CRN for an associated funeral expenses application
    // we need to process a second PDF after having updated some of the JSON data
    if (applicationJson.meta.funeralReference) {
        // Modify and duplicate JSON
        const duplicateKey = getSplitJsonFilename(jsonKey);
        const tempPath = `${temporaryLocation}/${path.parse(jsonKey).name}-split.json`;
        await duplicateJson(applicationJson, tempPath);

        // Upload the new JSON to S3 for the Tempus Broker to process as a separate application
        await s3Service.putInS3(bucket, tempPath, duplicateKey);

        // Generate and upload a second PDF and SQS
        const splitPdfLocation = await processPdf(applicationJson, duplicateKey, temporaryLocation);
        logger.info(
            {questionnaireId, funeralReference: caseReference},
            'Split funeral PDF generated and uploaded to S3'
        );

        // Send message to Tempus queue
        await sendToTempus({
            pdfLocation: splitPdfLocation,
            jsonKey: duplicateKey,
            message,
            questionnaireId,
            caseReference,
            isSplitFuneralPDF: true
        });
    }

    // Finally delete the consumed message from the Application Queue
    const deleteInput = {
        QueueUrl: applicationQueue,
        ReceiptHandle: message.ReceiptHandle
    };
    await sqsService.deleteSQS(deleteInput);
    logger.info({questionnaireId, caseReference}, 'Application message processing complete');
}

/**
 * Handles the entire SQS response, extracting individual messages for processing.
 * @param {string} message - The raw SQS response.
 */
async function handleMessage(sqsResponse) {
    if (sqsResponse.Messages) {
        sqsResponse.Messages.forEach(async message => {
            await processMessage(message);
        });
    }
}

/** Runs the application service, polling the Application Queue every 30 seconds. */
async function applicationService() {
    const sqsService = createSqsService();

    setInterval(async function pollSqs() {
        const receiveInput = {
            QueueUrl: applicationQueue,
            MaxNumberOfMessages: 10
        };
        const response = await sqsService.receiveSQS(receiveInput);
        await handleMessage(response);
    }, 30000);
}

module.exports = {
    applicationService,
    generatePDFLocation,
    parseJSONLocation,
    parseQuestionnaireId,
    processMessage,
    processPdf,
    handleMessage,
    duplicateJson,
    getSplitJsonFilename,
    sendToTempus
};
