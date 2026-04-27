'use strict';

const fs = require('fs');
const createPdfService = require('./index');

describe('PDF Service', () => {
    let pdfService;
    beforeEach(() => {
        pdfService = createPdfService();
    });

    it('Should generate a valid PDF document', async () => {
        const path = './resources/temp/output.pdf';
        const stream = fs.readFileSync('./resources/testing/checkYourAnswers.json');
        await pdfService.writeJSONToPDF(JSON.parse(stream), path);
        expect(fs.existsSync(path)).toBeTruthy();
    });

    it('Should generate a valid PDF document for non-application JSON', async () => {
        const path = './resources/temp/review-output.pdf';
        const stream = fs.readFileSync('./resources/testing/requestReview.json');
        await pdfService.writeJSONToPDF(JSON.parse(stream), path);
        expect(fs.existsSync(path)).toBeTruthy();
    });

    it('Should get PI application type', () => {
        const json = {
            meta: {
                caseReference: '23\\800001',
                funeralReference: '23\\800002',
                submittedDate: '2023-07-19T13:21:56.939Z'
            },
            themes: [
                {
                    id: 'about-application',
                    values: [
                        {
                            id: 'q-applicant-fatal-claim',
                            value: false
                        }
                    ]
                },
                {
                    id: 'crime',
                    values: [
                        {
                            id: 'q-applicant-did-the-crime-happen-once-or-over-time',
                            value: 'once'
                        }
                    ]
                }
            ]
        };
        const type = pdfService.calculateApplicationType(json);
        expect(type).toStrictEqual('Personal injury');
    });

    it('Should get POA application type', () => {
        const json = {
            meta: {
                caseReference: '23\\800001',
                funeralReference: '23\\800002',
                submittedDate: '2023-07-19T13:21:56.939Z'
            },
            themes: [
                {
                    id: 'about-application',
                    values: [
                        {
                            id: 'q-applicant-fatal-claim',
                            value: false
                        }
                    ]
                },
                {
                    id: 'crime',
                    values: [
                        {
                            id: 'q-applicant-did-the-crime-happen-once-or-over-time',
                            value: 'over-a-period-of-time'
                        }
                    ]
                }
            ]
        };
        const type = pdfService.calculateApplicationType(json);
        expect(type).toStrictEqual('Period of abuse');
    });

    it('Should get Fatal only application type', () => {
        const json = {
            meta: {
                caseReference: '23\\800001',
                funeralReference: '23\\800002',
                submittedDate: '2023-07-19T13:21:56.939Z'
            },
            themes: [
                {
                    id: 'about-application',
                    values: [
                        {
                            id: 'q-applicant-fatal-claim',
                            value: true
                        }
                    ]
                }
            ]
        };
        const type = pdfService.calculateApplicationType(json);
        expect(type).toStrictEqual('Fatal');
    });

    it('Should get Funeral application type when split', () => {
        const json = {
            meta: {
                splitFuneral: true
            },
            themes: [
                {
                    id: 'about-application',
                    values: [
                        {
                            id: 'q-applicant-fatal-claim',
                            value: true
                        }
                    ]
                }
            ]
        };
        const type = pdfService.calculateApplicationType(json);
        expect(type).toStrictEqual('Funeral');
    });

    it('Should get Funeral application type when not split', () => {
        const json = {
            meta: {
                caseReference: '23\\800001',
                funeralReference: '23\\800002',
                submittedDate: '2023-07-19T13:21:56.939Z'
            },
            themes: [
                {
                    id: 'about-application',
                    values: [
                        {
                            id: 'q-applicant-fatal-claim',
                            value: true
                        },
                        {
                            id: 'q-applicant-claim-type',
                            value: true
                        }
                    ]
                }
            ]
        };
        const type = pdfService.calculateApplicationType(json);
        expect(type).toStrictEqual('Funeral');
    });
});
