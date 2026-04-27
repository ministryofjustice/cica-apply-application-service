'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const QRCode = require('qrcode');
const logger = require('../logging/logger');

// Define default font configuration, by default PDFKit uses Helvetica
const defaults = {
    fontConfig: {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold'
    }
};

/**
 * Initialises font configuration for PDF generation
 * @param {Object} options - Configuration options
 * @param {Object} options.fontConfig - Optional font configuration with full paths to fonts
 * @returns {Object} Font configuration with regular and bold font paths
 */
function initialiseFonts({fontConfig = {}} = {}) {
    logger.info('initialiseFonts called with fontConfig:', JSON.stringify(fontConfig));

    const customConfig = {};

    try {
        if ('regular' in fontConfig && fs.existsSync(fontConfig.regular)) {
            customConfig.regular = fontConfig.regular;
        }
    } catch (error) {
        logger.info(
            `Font check failed, using built-in default.regular "${defaults.fontConfig.regular}":`,
            error.message
        );
    }

    try {
        if ('bold' in fontConfig && fs.existsSync(fontConfig.bold)) {
            customConfig.bold = fontConfig.bold;
        }
    } catch (error) {
        logger.info(
            `Font check failed, using built-in default.bold "${defaults.fontConfig.bold}":`,
            error.message
        );
    }

    return {
        ...defaults.fontConfig,
        ...customConfig
    };
}

/** Returns PDF Service object with a function to write a JSON to a PDF */
function createPdfService() {
    /**
     * Calculates the type of an application for compensation to be displayed on the Summary form.
     * @param {JSON} applicationJson
     * @returns string representation of application type
     */
    function calculateApplicationType(applicationJson) {
        let type = 'unknown';
        if (
            applicationJson.meta.type === undefined ||
            applicationJson.meta.type === 'apply-for-compensation'
        ) {
            if (
                applicationJson.themes
                    .find(t => t.id === 'about-application')
                    .values.find(q => q.id === 'q-applicant-fatal-claim')?.value
            ) {
                if (
                    applicationJson.themes
                        .find(t => t.id === 'about-application')
                        .values.find(q => q.id === 'q-applicant-claim-type')?.value ||
                    applicationJson.meta?.splitFuneral
                ) {
                    type = 'Funeral';
                } else {
                    type = 'Fatal';
                }
            } else if (
                applicationJson.themes
                    .find(t => t.id === 'crime')
                    .values.find(q => q.id === 'q-applicant-did-the-crime-happen-once-or-over-time')
                    ?.value === 'over-a-period-of-time'
            ) {
                type = 'Period of abuse';
            } else if (
                applicationJson.themes
                    .find(t => t.id === 'crime')
                    .values.find(q => q.id === 'q-applicant-did-the-crime-happen-once-or-over-time')
                    ?.value === 'once'
            ) {
                type = 'Personal injury';
            }
        }
        return type;
    }

    /**
     * Writes a given JSON to a PDF
     * @param {object} json - The json to write
     * @param {string} pdfLoc - The name of the pdf to save the generated PDF to
     * @returns Promise that resolves when the file has finished being written to
     */
    async function writeJSONToPDF(json, pdfLoc) {
        try {
            const fonts = initialiseFonts({
                fontConfig: {
                    regular: path.join(__dirname, 'fonts/NotoSans-Regular.ttf'),
                    bold: path.join(__dirname, 'fonts/NotoSans-Bold.ttf')
                }
            });

            logger.info(
                `PDF Generation - Using fonts: regular="${fonts.regular}", bold="${fonts.bold}"`
            );

            // Initialise core PDF Document
            const pdfDocument = new PDFDocument({bufferPages: true});
            const stream = fs.createWriteStream(pdfLoc);
            pdfDocument.pipe(stream);

            /**
             * Writes a Subquestion of a composite question to a new line of the PDF
             * @param {object} question - The sub question to write to the PDF
             */
            function addPDFSubquestion(question) {
                pdfDocument.fontSize(12.5).font(fonts.regular);
                if (question.format && question.format.value === 'date-time') {
                    pdfDocument.text(
                        Intl.DateTimeFormat('en-GB').format(
                            new Date(question.valueLabel || question.value)
                        ),
                        {indent: 30}
                    );
                } else {
                    pdfDocument.text(question.valueLabel || question.value, {indent: 30});
                }
            }

            /**
             * Writes all Subquestion answers from a single question to a single line in the PDF
             * @param {Array} questions - The array of subquestions
             */
            function addPDFSubquestions(questions) {
                pdfDocument.fontSize(12.5).font(fonts.regular);
                const answers = questions.map(question => question.value);
                pdfDocument.text(answers.join(' '));
            }

            /**
             * Writes the main questions to the PDF
             * @param {object} question - The question to write to the PDF
             */
            async function addPDFQuestion(question) {
                if (question.id === 'q-applicant-physical-injuries') {
                    pdfDocument
                        .fontSize(12.5)
                        .font(fonts.bold)
                        .fillColor('#444444')
                        .text('Physical injuries')
                        .font(fonts.regular);
                    pdfDocument.text(question.valueLabel.join('\n'));
                    pdfDocument.moveDown();
                } else if (question.type === 'simple') {
                    // If the question is simple then write the question to the PDF
                    pdfDocument
                        .fontSize(12.5)
                        .font(fonts.bold)
                        .fillColor('#444444')
                        .text(question.label)
                        .font(fonts.regular);
                    if (question.format && question.format.value === 'date-time') {
                        pdfDocument.text(
                            Intl.DateTimeFormat('en-GB').format(
                                new Date(question.valueLabel || question.value)
                            )
                        );
                    } else if (Array.isArray(question.valueLabel)) {
                        pdfDocument.text(question.valueLabel.join('\n'));
                    } else {
                        pdfDocument.text(question.valueLabel || question.value);
                    }
                    pdfDocument.moveDown();
                } else {
                    // Otherwise the question is composite, so write the question label and write each subquestion using addPDFSubquestion
                    pdfDocument
                        .fontSize(12.5)
                        .font(fonts.bold)
                        .fillColor('#444444')
                        .text(question.label);
                    if (question.id.includes('name')) {
                        addPDFSubquestions(question.values);
                    } else {
                        Object.keys(question.values).forEach(q => {
                            addPDFSubquestion(question.values[q]);
                        });
                    }
                    pdfDocument.moveDown();
                }
            }

            /**
             * Writes the static PDF header
             * @param {JSON} documentJson - The JSON of the submitted data
             */
            function writeHeader(documentJson) {
                // TODO: as the number of different documents increases a mapping of type to summary and title could be stored in a separate file, or passed in from DCS
                const documentType = documentJson.meta.type;
                let title = '';
                let summaryText = '';
                if (documentType === undefined || documentType === 'apply-for-compensation') {
                    title = 'CICA Summary Application Form';
                    summaryText =
                        'This document provides a summary of the information supplied to CICA in your application form. Please contact us on 0300 003 3601 if you require any changes to be made.';
                } else {
                    title = 'CICA Request for Review';
                    summaryText = `This document provides a summary of the information supplied to CICA in your request for a review of your nil decision for case ${json.meta.caseReference}.`;
                }
                pdfDocument
                    .fontSize(10)
                    .font(fonts.regular)
                    .fillColor('#808080')
                    .text('Protect-Personal', {align: 'center'})
                    .image('./public/cicaLogo.png', 450, 80, {width: 80})
                    .text('Tel: 0300 003 3601')
                    .text('CICA')
                    .text('10 Clyde Place, Buchanan Wharf')
                    .text('Glasgow G5 8AQ')
                    .text('www.cica.gov.uk')
                    .moveDown()
                    .fillColor('#444444')
                    .fontSize(25)
                    .font(fonts.bold)
                    .text(title)
                    .fontSize(10)
                    .moveDown()
                    .font(fonts.regular)
                    .fillColor('#808080')
                    .text(summaryText)
                    .moveDown();
            }

            /**
             * Writes footer to given document (called per page via buffer)
             * @param {PDFDocument} document
             */
            function writeFooter(document) {
                // Need to set the bottom margin to zero to allow writing the footer into the margin
                const {bottom} = document.page.margins;
                document.page.margins.bottom = 0;
                const date = Intl.DateTimeFormat('en-GB', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true,
                    timeZone: 'Europe/London'
                }).format(new Date());
                document
                    .fontSize(10)
                    .font(fonts.regular)
                    .fillColor('#808080')
                    .text(
                        `Case reference number:         ${json.meta.caseReference}        Submitted on:        ${date}`,
                        0,
                        document.page.height - 25,
                        {
                            align: 'center',
                            lineBreak: false,
                            width: document.page.width
                        }
                    );
                // Reset text writer position
                document.text('', 50, 50);
                // Reset the bottom margin back to what it was
                document.page.margins.bottom = bottom;
            }

            /**
             * Calculates the application type of an application for compensation and writes it to the document
             */
            function writeApplicationType() {
                const type = calculateApplicationType(json);

                pdfDocument
                    .fontSize(12.5)
                    .font(fonts.bold)
                    .fillColor('#444444')
                    .text('Application Type')
                    .font(fonts.regular);
                pdfDocument.text(type);
                pdfDocument.moveDown();
            }

            /**
             * Clean a given string, trimming white space and ensuring all white space is in the correct format
             * @param {String} text
             * @returns The cleaned string
             */
            function cleanText(text) {
                return text.replace(/\s+/g, ' ').trim();
            }

            /**
             * Write the HTML declaration string to the document
             * @param {PDFDocument} document
             * @param {String} declaration
             */
            function writeDeclaration(document, declaration) {
                const $ = cheerio.load(declaration);
                const elements = $('div[id="declaration"] *');

                $(elements).each((index, element) => {
                    if (element.name === 'p') {
                        document
                            .fontSize(12)
                            .font(fonts.regular)
                            .moveDown()
                            .text(cleanText($(element).text()));
                    } else if (element.name === 'li') {
                        const depth = $(element).parentsUntil('div[id="declaration"]').length;
                        let listItem = [cleanText($(element).text())];
                        for (let i = 0; i < depth; i += 1) {
                            listItem = [listItem]; // Nested arrays created nested lists
                        }
                        document
                            .fontSize(12)
                            .font(fonts.regular)
                            .list(listItem, {textIndent: 20, bulletIndent: 20});
                    } else if (element.name.includes('h')) {
                        document
                            .fontSize(18)
                            .font(fonts.bold)
                            .moveDown()
                            .text(cleanText($(element).text()));
                    }
                });
                // Now write the date and line stating they agree
                document.moveDown();
                document
                    .fontSize(12)
                    .font(fonts.bold)
                    .text(
                        `Date: ${Intl.DateTimeFormat('en-GB').format(
                            new Date(json.meta.submittedDate)
                        )}`
                    );
                document.moveDown();
                document
                    .fontSize(12)
                    .font(fonts.bold)
                    .text(json.declaration.valueLabel);
            }

            /**
             * Check if there is not enough space at the current position on the page relative to the bottom margin
             * @param {PDFDocument} document
             * @returns true if there is not enough space to write text
             */
            function checkEndOfPage(document) {
                const bottomMargin = document.page.margins.bottom;
                const bottomBorder = document.page.height;
                const yPos = document.y;
                const lineHeight = document.currentLineHeight();

                return yPos > bottomBorder - bottomMargin - lineHeight - 25;
            }

            async function generateLetterBarcode(barcodeString) {
                // Generate QR Code and convert base64 to buffer
                // QRCode.toFile('./test.png', barcodeString);
                const qrDataUrl = await QRCode.toDataURL(barcodeString);

                // Convert base64 to buffer
                const qrImage = qrDataUrl.replace(/^data:image\/png;base64,/, '');
                return Buffer.from(qrImage, 'base64');
            }

            // Write the main header to the beginning of the document
            writeHeader(json);

            // Write the Application Type to the beginning of the document
            // Only applies to applications for compensation
            if (json.meta.type === undefined || json.meta.type === 'apply-for-compensation') {
                writeApplicationType();
            }

            // Loops over each theme in the json, and for each writes the header and then
            //     loops through each question in the theme, which are each written using addPDFQuestion
            Object.keys(json.themes).forEach(t => {
                if (checkEndOfPage(pdfDocument)) {
                    // If we are too close to the bottom of the page, start writing the header
                    // to the top of a new page instead. This is calculated based on the current Y position
                    // in relation to the bottom border of the page, with a buffer of (25 + line height)
                    /* istanbul ignore next */
                    pdfDocument.addPage();
                }

                const theme = json.themes[t];
                pdfDocument.fontSize(14.5).font(fonts.bold);

                const height = pdfDocument.currentLineHeight();
                pdfDocument
                    .rect(pdfDocument.x - 5, pdfDocument.y - 6, 480, height + 10)
                    .fill('#000');

                pdfDocument.fillColor('#FFF').text(theme.title, {underline: false});

                pdfDocument.moveDown();

                Object.keys(theme.values).forEach(question => {
                    if (!theme.values[question].meta?.integration?.hideOnSummary) {
                        addPDFQuestion(theme.values[question]);
                    }
                });
            });

            pdfDocument.fillColor('#444444');

            // Consent summary header
            // Only applies for applications for compensation
            if (json.declaration) {
                if (checkEndOfPage(pdfDocument)) {
                    pdfDocument.addPage();
                }
                pdfDocument.fontSize(14.5).font(fonts.bold);
                const height = pdfDocument.currentLineHeight();
                pdfDocument
                    .rect(pdfDocument.x - 5, pdfDocument.y - 6, 480, height + 10)
                    .fill('#000');
                pdfDocument.fillColor('#FFF').text('Consent & Declaration', {underline: false});
                pdfDocument.moveDown();

                pdfDocument.fillColor('#444444');

                // Write the HTML string from the declaration section of the application json.
                writeDeclaration(pdfDocument, json.declaration.label);
            }
            if (json.meta.barcodeString) {
                const imgBuffer = await generateLetterBarcode(json.meta.barcodeString);
                pdfDocument.addPage();
                pdfDocument.image(imgBuffer, {
                    fit: [250, 250],
                    align: 'center',
                    valign: 'center'
                });
            }
            const pages = pdfDocument.bufferedPageRange();
            for (let i = 0; i < pages.count; i += 1) {
                pdfDocument.switchToPage(i);
                writeFooter(pdfDocument);
            }

            pdfDocument.end();
            await new Promise(resolve => {
                stream.on('finish', resolve);
            });
        } catch (err) {
            logger.info(`Error processing case ${json.meta.caseReference}`);
            throw err;
        }
    }

    return Object.freeze({
        writeJSONToPDF,
        calculateApplicationType,
        initialiseFonts // Expose for testing
    });
}

module.exports = createPdfService;
