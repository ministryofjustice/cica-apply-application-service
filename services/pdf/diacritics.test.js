'use strict';

const fs = require('fs');
const createPdfService = require('./index');

// Import test fixtures
const europeanDiacritics = require('../../resources/testing/diacritics-european.json');
const frenchDiacritics = require('../../resources/testing/diacritics-french.json');
const polishDiacritics = require('../../resources/testing/diacritics-polish.json');
const multilangDiacritics = require('../../resources/testing/diacritics-multilang.json');
const compositeDiacritics = require('../../resources/testing/diacritics-composite.json');
const declarationDiacritics = require('../../resources/testing/diacritics-declaration.json');

describe('PDF Service - Diacritical Character Support', () => {
    let pdfService;

    beforeAll(() => {
        const tempDir = './resources/temp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, {recursive: true});
        }
    });

    beforeEach(() => {
        pdfService = createPdfService();
    });

    afterEach(() => {
        // Clean up test PDFs
        const testFiles = [
            './resources/temp/diacritics-european.pdf',
            './resources/temp/diacritics-french.pdf',
            './resources/temp/diacritics-polish.pdf',
            './resources/temp/diacritics-multilang.pdf',
            './resources/temp/diacritics-composite.pdf',
            './resources/temp/diacritics-declaration.pdf'
        ];
        testFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });

    describe('Font Initialization', () => {
        it('Should initialize Noto Sans fonts when available', () => {
            const fonts = pdfService.initialiseFonts();

            expect(fonts).toHaveProperty('regular');
            expect(fonts).toHaveProperty('bold');

            if (fonts.regular.includes('.ttf')) {
                expect(fonts.regular).toContain('NotoSans');
            }
        });

        it('Should fall back to Helvetica when Noto Sans fonts are not available', () => {
            const fonts = pdfService.initialiseFonts('/nonexistent/path');

            expect(fonts.regular).toBe('Helvetica');
            expect(fonts.bold).toBe('Helvetica-Bold');
        });
    });

    describe('Diacritical Character Rendering', () => {
        it('Should generate PDF with common European diacritical characters', async () => {
            const path = './resources/temp/diacritics-european.pdf';

            await pdfService.writeJSONToPDF(europeanDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('Should handle French accented characters', async () => {
            const path = './resources/temp/diacritics-french.pdf';

            await pdfService.writeJSONToPDF(frenchDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('Should handle Polish characters (ł, ą, ę, ć, ń, ó, ś, ź, ż)', async () => {
            const path = './resources/temp/diacritics-polish.pdf';

            await pdfService.writeJSONToPDF(polishDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('Should handle multiple languages with various diacritics in one document', async () => {
            const path = './resources/temp/diacritics-multilang.pdf';

            await pdfService.writeJSONToPDF(multilangDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('Should handle composite questions with diacritical characters', async () => {
            const path = './resources/temp/diacritics-composite.pdf';

            await pdfService.writeJSONToPDF(compositeDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
        });

        it('Should handle HTML declaration with diacritical characters', async () => {
            const path = './resources/temp/diacritics-declaration.pdf';

            await pdfService.writeJSONToPDF(declarationDiacritics, path);

            expect(fs.existsSync(path)).toBeTruthy();
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
        });
    });
});
