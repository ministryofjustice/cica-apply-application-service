/**
 * Manual PDF Generation Test Script
 *
 * Purpose:
 * This script generates test PDFs to verify that the Noto Sans font embedding
 * is working correctly with diacritical characters. It's useful for quick manual
 * testing during development and for visual verification of font rendering.
 *
 * Usage:
 * node services/pdf/manual-pdf-test.js
 *
 * Output:
 * Generates PDFs in resources/temp/:
 * - polish-chars-test.pdf (Polish characters: ł, ą, ę, ć, ń, ó, ś, ź, ż)
 * - diacritic-chars-test.pdf (Various European diacritical characters)
 *
 */

'use strict';

const fs = require('fs');
const path = require('path');
const createPdfService = require('./index');
const polishChar = require('../../resources/testing/polish-chars-test.json');
const diacriticChars = require('../../resources/testing/diacritic-chars-test.json');

async function runTest() {
    console.log('Starting PDF generation tests...\n');

    const tempDir = path.join(__dirname, '../../resources/temp');
    if (!fs.existsSync(tempDir)) {
        console.log(`Creating directory: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const pdfService = createPdfService();

    // Test configurations
    const tests = [
        {
            name: 'Polish Characters',
            json: polishChar,
            outputFile: 'polish-chars-test.pdf',
            description: 'Tests Polish diacritical characters (ł, ą, ę, ć, ń, ó, ś, ź, ż)'
        },
        {
            name: 'Diacritical Characters',
            json: diacriticChars,
            outputFile: 'diacritic-chars-test.pdf',
            description: 'Tests various European diacritical characters'
        }
    ];

    let successCount = 0;
    let failureCount = 0;

    // Run each test
    for (const test of tests) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Test: ${test.name}`);
        console.log(`Description: ${test.description}`);
        console.log(`${'='.repeat(60)}`);

        const outputPath = path.join(tempDir, test.outputFile);
        console.log(`Output path: ${outputPath}`);

        try {
            await pdfService.writeJSONToPDF(test.json, outputPath);

            // Verify the file was created
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`✓ PDF generated successfully!`);
                console.log(`  File: ${outputPath}`);
                console.log(`  Size: ${stats.size} bytes`);
                successCount++;
            } else {
                console.error(`✗ PDF file was not created`);
                failureCount++;
            }
        } catch (error) {
            console.error(`✗ Error generating PDF: ${error.message}`);
            console.error(error.stack);
            failureCount++;
        }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('Test Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total tests: ${tests.length}`);
    console.log(`✓ Passed: ${successCount}`);
    console.log(`✗ Failed: ${failureCount}`);
    console.log(`${'='.repeat(60)}\n`);

    if (failureCount > 0) {
        console.error('Some tests failed!');
        process.exit(1);
    }

    console.log('All tests completed successfully!');
}

runTest();

