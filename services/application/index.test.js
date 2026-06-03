'use strict';

const fs = require('fs');
const {mockClient} = require('aws-sdk-client-mock');
const {SendMessageCommand, SQSClient} = require('@aws-sdk/client-sqs');
const applicationService = require('.');

describe('Application Service', () => {
    it('Should generate a valid PDF location based on the case reference', async () => {
        // Arrange
        const stream = fs.readFileSync('resources/testing/checkYourAnswers.json');

        // Act
        const location = applicationService.generatePDFLocation(JSON.parse(stream));

        // Assert
        expect(location).toEqual('23-800001/application-summary.pdf');
    });

    it('Should parse the JSON location from an SQS message', async () => {
        // Arrange
        const stream = fs.readFileSync('resources/testing/sqsMessage.json');

        // Act
        const location = applicationService.parseJSONLocation(JSON.parse(stream).Messages[0]);

        // Assert
        expect(location).toEqual('test/sample-location.json');
    });

    it('Should throw an error if the file types are wrong', async () => {
        // Arrange
        const stream = fs.readFileSync('resources/testing/invalidSqsMessage.json');

        // Act and Assert
        expect(() => {
            applicationService.parseJSONLocation(JSON.parse(stream).Messages[0]);
        }).toThrowError('Application JSON document location is not in a valid format (.json)');
    });

    it('Should duplicate the application JSON file having updated the relevant data for a split app', async () => {
        // Arrange
        const stream = fs.readFileSync('resources/testing/checkYourAnswers.json');
        const application = JSON.parse(stream);
        const path = './resources/temp/duplicate.json';

        // Act and Assert
        await applicationService.duplicateJson(application, path);
        expect(fs.existsSync(path)).toBeTruthy();
        expect(JSON.parse(fs.readFileSync(path)).meta.caseReference).toStrictEqual(
            application.meta.funeralReference
        );
        expect(JSON.parse(fs.readFileSync(path)).meta.splitFuneral).toBeTruthy();
    });

    it('Should generate the correct filename for the split duplicate JSON', async () => {
        // Arrange
        const key = 'testdirectory/originalfile.json';

        // Act and Assert
        const splitKey = applicationService.getSplitJsonFilename(key);
        expect(splitKey).toBe('testdirectory/originalfile-split.json');
    });

    it('Should return the questionnaireId from an SQS message body', () => {
        // Arrange
        const message = {
            Body: JSON.stringify({
                applicationJSONDocumentSummaryKey: 'test/sample-location.json',
                questionnaireId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            })
        };

        // Act
        const result = applicationService.parseQuestionnaireId(message);

        // Assert
        expect(result).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    });

    it('Should return null when questionnaireId is not present in the SQS message body', () => {
        // Arrange
        const message = {
            Body: JSON.stringify({
                applicationJSONDocumentSummaryKey: 'test/sample-location.json'
            })
        };

        // Act
        const result = applicationService.parseQuestionnaireId(message);

        // Assert
        expect(result).toBeNull();
    });

    it('Should return null when questionnaireId is explicitly null in the SQS message body', () => {
        // Arrange
        const message = {
            Body: JSON.stringify({
                applicationJSONDocumentSummaryKey: 'test/sample-location.json',
                questionnaireId: null
            })
        };

        // Act
        const result = applicationService.parseQuestionnaireId(message);

        // Assert
        expect(result).toBeNull();
    });

    it('Should send to tempus', async () => {
        // Arrange
        const sqsMock = mockClient(SQSClient);
        sqsMock.on(SendMessageCommand).resolves('Message Sent');

        const pdfLocation = 'bucket/directory/summary.pdf';
        const key = 'testdirectory/originalfile.json';
        const message = {
            Body: '{"applicationJSONDocumentSummaryKey": "test/sample-location.json"}'
        };

        const result = await applicationService.sendToTempus({pdfLocation, jsonKey: key, message});

        // Act and Assert
        expect(result).toBe('Message Sent');
    });

    it('Should not send to tempus', async () => {
        // Arrange
        const sqsMock = mockClient(SQSClient);
        sqsMock.on(SendMessageCommand).resolves('Message Sent');

        const pdfLocation = 'bucket/directory/summary.pdf';
        const key = 'testdirectory/originalfile.json';
        const message = {
            Body:
                '{"applicationJSONDocumentSummaryKey": "test/sample-location.json", "regeneratePdf": true}'
        };

        const result = await applicationService.sendToTempus({pdfLocation, jsonKey: key, message});

        // Act and Assert
        expect(result).toBe('Skipped sending to Tempus');
    });
});
