'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const cheerio = require('cheerio');
const logger = require('../logging/logger');

/** Returns PDF Service object with a function to write a JSON to a PDF */
function createPdfService() {
    /**
     * Calculates the type of application to be displayed on the Summary form.
     * @param {JSON} applicationJson
     * @returns string representation of application type
     */
    function calculateApplicationType(applicationJson) {
        let type = 'Unknown';

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

        return type;
    }

    /**
     * Writes a given JSON to a PDF
     * @param {object} json - The json to write
     * @param {string} pdfLoc - The name of the pdf to save the generated PDF to
     * @returns Promise that resolves when the file has finished being written to
     */
    async function writeJSONToPDF(json, pdfLoc) {
        return new Promise(res => {
            // Initialise core PDF Document
            const pdfDocument = new PDFDocument({bufferPages: true});
            const stream = fs.createWriteStream(pdfLoc);
            pdfDocument.pipe(stream);

            /**
             * Writes a Subquestion of a composite question to a new line of the PDF
             * @param {object} question - The sub question to write to the PDF
             */
            function addPDFSubquestion(question) {
                pdfDocument.fontSize(12.5).font('Helvetica');
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
                pdfDocument.fontSize(12.5).font('Helvetica');
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
                        .font('Helvetica-Bold')
                        .fillColor('#444444')
                        .text('Physical injuries')
                        .font('Helvetica');
                    pdfDocument.text(question.valueLabel.join('\n'));
                    pdfDocument.moveDown();
                } else if (question.type === 'simple') {
                    // If the question is simple then write the question to the PDF
                    pdfDocument
                        .fontSize(12.5)
                        .font('Helvetica-Bold')
                        .fillColor('#444444')
                        .text(question.label)
                        .font('Helvetica');
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
                        .font('Helvetica-Bold')
                        .fillColor('#444444')
                        .text(question.label);
                    if (question.id.includes('name')) {
                        addPDFSubquestions(question.values);
                    } else {
                        Object.keys(question.values).forEach(function(q) {
                            addPDFSubquestion(question.values[q]);
                        });
                    }
                    pdfDocument.moveDown();
                }
            }

            /**
             * Writes the static PDF header
             */
            function writeHeader() {
                pdfDocument
                    .fontSize(10)
                    .font('Helvetica')
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
                    .font('Helvetica-Bold')
                    .text('CICA Summary Application Form')
                    .fontSize(10)
                    .moveDown()
                    .font('Helvetica')
                    .fillColor('#808080')
                    .text(
                        'This document provides a summary of the information supplied to CICA in your application form. Please contact us on 0300 003 3601 if you require any changes to be made.'
                    )
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
                const date = Intl.DateTimeFormat('en-gb', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true
                }).format(new Date());
                document
                    .fontSize(10)
                    .font('Helvetica')
                    .fillColor('#808080')
                    .text(
                        `Case reference no.:         ${json.meta.caseReference}        Submitted on:        ${date}`,
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
             * Calculates the application type and writes it to the document
             */
            function writeApplicationType() {
                const type = calculateApplicationType(json);

                pdfDocument
                    .fontSize(12.5)
                    .font('Helvetica-Bold')
                    .fillColor('#444444')
                    .text('Application Type')
                    .font('Helvetica');
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
                            .font('Helvetica')
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
                            .font('Helvetica')
                            .list(listItem, {textIndent: 20, bulletIndent: 20});
                    } else if (element.name.includes('h')) {
                        document
                            .fontSize(18)
                            .font('Helvetica-Bold')
                            .moveDown()
                            .text(cleanText($(element).text()));
                    }
                });
                // Now write the date and line stating they agree
                document.moveDown();
                document
                    .fontSize(12)
                    .font('Helvetica-Bold')
                    .text(
                        `Date: ${Intl.DateTimeFormat('en-GB').format(
                            new Date(json.meta.submittedDate)
                        )}`
                    );
                document.moveDown();
                document
                    .fontSize(12)
                    .font('Helvetica-Bold')
                    .text(json.declaration.valueLabel);
            }

            // Write the main header to the beginning of the document
            writeHeader();

            // Write the Application Type to the beginning of the document
            writeApplicationType();

            // Loops over each theme in the json, and for each writes the header and then
            //     loops through each question in the theme, which are each written using addPDFQuestion
            Object.keys(json.themes).forEach(function(t) {
                const bottomMargin = pdfDocument.page.margins.bottom;
                const bottomBorder = pdfDocument.page.height;
                const yPos = pdfDocument.y;
                const lineHeight = pdfDocument.currentLineHeight();

                // If we are too close to the bottom of the page, start writing the header
                // to the top of a new page instead. This is calculated based on the current Y position
                // in relation to the bottom border of the page, with a buffer of (25 + line height)
                /* istanbul ignore next */

                if (yPos > bottomBorder - bottomMargin - lineHeight - 25) {
                    pdfDocument.addPage();
                }

                const theme = json.themes[t];
                pdfDocument.fontSize(14.5).font('Helvetica-Bold');

                const height = pdfDocument.currentLineHeight();
                pdfDocument
                    .rect(pdfDocument.x - 5, pdfDocument.y - 6, 480, height + 10)
                    .fill('#000');

                pdfDocument.fillColor('#FFF').text(theme.title, {underline: false});

                pdfDocument.moveDown();

                Object.keys(theme.values).forEach(function(question) {
                    if (!theme.values[question].meta?.integration?.hideOnSummary) {
                        addPDFQuestion(theme.values[question]);
                    }
                });
            });

            pdfDocument.fillColor('#444444');

            // Consent summary header
            pdfDocument.fontSize(14.5).font('Helvetica-Bold');
            const height = pdfDocument.currentLineHeight();
            pdfDocument.rect(pdfDocument.x - 5, pdfDocument.y - 6, 480, height + 10).fill('#000');
            pdfDocument.fillColor('#FFF').text('Consent & Declaration', {underline: false});
            pdfDocument.moveDown();

            pdfDocument.fillColor('#444444');

            // Write the HTML string from the declaration section of the application json.
            writeDeclaration(pdfDocument, json.declaration.label);

            const pages = pdfDocument.bufferedPageRange();
            for (let i = 0; i < pages.count; i += 1) {
                pdfDocument.switchToPage(i);
                writeFooter(pdfDocument);
            }

            pdfDocument.end();
            stream.on('finish', function() {
                res(true);
            });
        }).catch(err => logger.error(err));
    }

    return Object.freeze({
        writeJSONToPDF,
        calculateApplicationType
    });
}

module.exports = createPdfService;
