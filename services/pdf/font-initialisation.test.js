'use strict';

const fs = require('fs');
const path = require('path');
const createPdfService = require('./index');

jest.mock('fs');

describe('Font Initialization', () => {
    let pdfService;

    beforeEach(() => {
        jest.clearAllMocks();
        pdfService = createPdfService();
    });

    describe('initialiseFonts', () => {
        it('should use built-in Helvetica fonts when no fontConfig provided', () => {
            const fonts = pdfService.initialiseFonts();

            expect(fonts.regular).toBe('Helvetica');
            expect(fonts.bold).toBe('Helvetica-Bold');
        });

        it('should use built-in Helvetica fonts when empty fontConfig provided', () => {
            const fonts = pdfService.initialiseFonts({fontConfig: {}});

            expect(fonts.regular).toBe('Helvetica');
            expect(fonts.bold).toBe('Helvetica-Bold');
        });

        it('should use custom regular font when it exists', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';

            fs.existsSync.mockImplementation(filePath => {
                return filePath === customRegularPath;
            });

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath
                }
            });

            expect(fonts.regular).toBe(customRegularPath);
            expect(fonts.bold).toBe('Helvetica-Bold'); // Falls back to default
        });

        it('should use custom bold font when it exists', () => {
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockImplementation(filePath => {
                return filePath === customBoldPath;
            });

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    bold: customBoldPath
                }
            });

            expect(fonts.regular).toBe('Helvetica'); // Falls back to default
            expect(fonts.bold).toBe(customBoldPath);
        });

        it('should use both custom fonts when they both exist', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockReturnValue(true);

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath,
                    bold: customBoldPath
                }
            });

            expect(fonts.regular).toBe(customRegularPath);
            expect(fonts.bold).toBe(customBoldPath);
            expect(fs.existsSync).toHaveBeenCalledWith(customRegularPath);
            expect(fs.existsSync).toHaveBeenCalledWith(customBoldPath);
        });

        it('should fall back to Helvetica when custom fonts do not exist', () => {
            const customRegularPath = '/nonexistent/fonts/NotoSans-Regular.ttf';
            const customBoldPath = '/nonexistent/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockReturnValue(false);

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath,
                    bold: customBoldPath
                }
            });

            expect(fonts.regular).toBe('Helvetica');
            expect(fonts.bold).toBe('Helvetica-Bold');
        });

        it('should handle mixed scenario where only regular font exists', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';
            const customBoldPath = '/nonexistent/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockImplementation(filePath => {
                return filePath === customRegularPath;
            });

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath,
                    bold: customBoldPath
                }
            });

            expect(fonts.regular).toBe(customRegularPath);
            expect(fonts.bold).toBe('Helvetica-Bold'); // Falls back for bold
        });

        it('should handle mixed scenario where only bold font exists', () => {
            const customRegularPath = '/nonexistent/fonts/NotoSans-Regular.ttf';
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockImplementation(filePath => {
                return filePath === customBoldPath;
            });

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath,
                    bold: customBoldPath
                }
            });

            expect(fonts.regular).toBe('Helvetica'); // Falls back for regular
            expect(fonts.bold).toBe(customBoldPath);
        });

        it('should handle file system errors gracefully for regular font', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';

            fs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });

            // Should not throw and fall back to default fonts
            expect(() => {
                const fonts = pdfService.initialiseFonts({
                    fontConfig: {
                        regular: customRegularPath
                    }
                });
                expect(fonts.regular).toBe('Helvetica');
                expect(fonts.bold).toBe('Helvetica-Bold');
            }).not.toThrow();
        });

        it('should handle file system errors gracefully for bold font', () => {
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });

            // Should not throw and fall back to default fonts
            expect(() => {
                const fonts = pdfService.initialiseFonts({
                    fontConfig: {
                        bold: customBoldPath
                    }
                });
                expect(fonts.regular).toBe('Helvetica');
                expect(fonts.bold).toBe('Helvetica-Bold');
            }).not.toThrow();
        });

        it('should handle file system errors gracefully for both fonts', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });

            // Should not throw and fall back to default fonts
            expect(() => {
                const fonts = pdfService.initialiseFonts({
                    fontConfig: {
                        regular: customRegularPath,
                        bold: customBoldPath
                    }
                });
                expect(fonts.regular).toBe('Helvetica');
                expect(fonts.bold).toBe('Helvetica-Bold');
            }).not.toThrow();
        });
    });

    describe('Font path validation', () => {
        it('should check for existence of provided custom font paths', () => {
            const customRegularPath = '/test/fonts/CustomFont-Regular.ttf';
            const customBoldPath = '/test/fonts/CustomFont-Bold.ttf';

            fs.existsSync.mockReturnValue(true);

            pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath,
                    bold: customBoldPath
                }
            });

            expect(fs.existsSync).toHaveBeenCalledWith(customRegularPath);
            expect(fs.existsSync).toHaveBeenCalledWith(customBoldPath);
        });

        it('should not call fs.existsSync when no fontConfig provided', () => {
            pdfService.initialiseFonts();

            expect(fs.existsSync).not.toHaveBeenCalled();
        });

        it('should only check regular font if only regular is provided', () => {
            const customRegularPath = '/test/fonts/NotoSans-Regular.ttf';

            fs.existsSync.mockReturnValue(true);

            pdfService.initialiseFonts({
                fontConfig: {
                    regular: customRegularPath
                }
            });

            expect(fs.existsSync).toHaveBeenCalledWith(customRegularPath);
            expect(fs.existsSync).toHaveBeenCalledTimes(1);
        });

        it('should only check bold font if only bold is provided', () => {
            const customBoldPath = '/test/fonts/NotoSans-Bold.ttf';

            fs.existsSync.mockReturnValue(true);

            pdfService.initialiseFonts({
                fontConfig: {
                    bold: customBoldPath
                }
            });

            expect(fs.existsSync).toHaveBeenCalledWith(customBoldPath);
            expect(fs.existsSync).toHaveBeenCalledTimes(1);
        });
    });

    describe('Integration with actual usage', () => {
        it('should work with typical Noto Sans font paths', () => {
            const baseDir = __dirname;
            const regularPath = path.join(baseDir, '../fonts/NotoSans-Regular.ttf');
            const boldPath = path.join(baseDir, '../fonts/NotoSans-Bold.ttf');

            fs.existsSync.mockReturnValue(true);

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: regularPath,
                    bold: boldPath
                }
            });

            expect(fonts.regular).toBe(regularPath);
            expect(fonts.bold).toBe(boldPath);
        });

        it('should support diacritical characters when Noto Sans is used', () => {
            // This is more of a documentation test showing the purpose
            const regularPath = path.join(__dirname, '../fonts/NotoSans-Regular.ttf');
            const boldPath = path.join(__dirname, '../fonts/NotoSans-Bold.ttf');

            fs.existsSync.mockReturnValue(true);

            const fonts = pdfService.initialiseFonts({
                fontConfig: {
                    regular: regularPath,
                    bold: boldPath
                }
            });

            // When Noto Sans fonts exist, they should be used
            // This enables proper rendering of diacritical characters
            expect(fonts.regular).toContain('NotoSans-Regular.ttf');
            expect(fonts.bold).toContain('NotoSans-Bold.ttf');
        });
    });
});
