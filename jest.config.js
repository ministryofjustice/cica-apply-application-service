'use strict';

const config = {
    testTimeout: 20000
};

process.env.DCS_JWT_SECRET = '';
process.env.DCS_LOG_LEVEL = 'silent';
process.env.APP_ENV = 'test';
process.env.S3_BUCKET = 'test-default-bucket';

config.coverageThreshold = {
    global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
    }
};

module.exports = config;
