# Application service (Node.js)
This application is set up to run as a container in a Kubernetes environment with the end goals being to:
- Generate an Application Summary Form (PDF format) and insert this into S3
- Forward on the SQS message to the Tempus Broker (via Tempus Queue) containing a reference to the S3 location that the application summary was uploaded to.

Key process steps:

- The function is triggered by an SQS event which contains an S3 key for an application PDF and its corresponding JSON data.
- The function will retrieve the JSON from an S3 bucket generate a PDF dynamically using a library called PDFKit
- This generated PDF will be uploaded to S3
- A new SQS message is generated containing the original data, with the new upload location added as a separate key

The project source includes the following directories:

- `app.js` - The entry point for the application. Setup as an expressJS API however acts more like a serverless consumer (MoJ CP doesn't support Lambda)
- `resources/testing` - Various sample data used for testing.
- `services/s3` - Supports integration with AWS S3.
- `services/sqs` - Supports integration with AWS SQS.
- `services/logging` - Supports logging out to std out.
- `services/pdf` - Supports PDF generation capabilities using PDF Kit.
- `services/pdf/fonts/` - Directory containing Noto Sans font to override default font in PDF kit. Noto Sans font added support for proper rendering of diacritical characters (e.g., ł, ą, ę, ć, ń, ó, ś, ź, ż, é, è, ê, ü, ö, å, etc.).


# Requirements
- [Node.js 18.16.1 or later with npm](https://nodejs.org/en/download/releases/)
- The Bash shell. For Linux and macOS, this is included by default. In Windows 10, you can install the [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10) to get a Windows-integrated version of Ubuntu and Bash.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

Not mandatory but useful if using VSCode:
- Prettier formatter extension
- AWS Toolkit extension

# Local development setup

Download or clone this repository.
Add an .env file containing:

   ```
    NODE_ENV='local'
    APPLICATION_QUEUE_ID='http://localhost:4566/000000000000/application-queue'
    TEMPUS_QUEUE_ID='http://localhost:4566/000000000000/tempus-queue'
    S3_BUCKET='application-bucket'
   ```

Configure local AWS environment:

The application service uses localstack for easy setup of AWS services and resources for local development. The setup can be found in the Makefile of this directory.

Open this project directory in terminal and run:
 - `make init` (if running for the first time)
 - `make start`
 - `make create-bucket`
 - `make create-queues`
 - `make upload-json`
 - `make send-message`
This will run in the `resources/testing/checkYourAnswers.json` test file by default, so for changing what your test data is, either update this file or update the reference to change which file gets uploaded in the Makefile.

The above steps are the minimum required to upload to the bucket and send a message for consumption to the queue, there's some other supporting commands that can help debugging such as `purge-queue`, `list-objects`, `poll-tempus`.

To check the localstack container is running, you can run `docker ps`

Use `npm run start` to run the function locally to consume any messages in the localstack SQS queue. It polls every 30 seconds, so make sure you wait for that amount of time before giving up on it!

# Test

To run all tests with test coverage, use:
`npx --no-install jest --ci --runInBand --bail --silent --coverage --projects jest.config.js`

To run tests with a debugger attached, use the Run and Debug panel within VS code. The configurations for this can be adjusted in
`.vscode/launch.json`

****
## Diacritical Character Testing

### Test Coverage

**Unit Tests** (`services/pdf/font-initialisation.test.js`):
- Font initialization logic
- Fallback behavior when fonts are unavailable
- Path construction and error handling

**Integration Tests** (`services/pdf/diacritics.test.js`):
- PDF generation with Polish, French, German, Spanish, and Scandinavian characters
- Composite questions with diacritics
- HTML declarations with special characters

**Manual Testing** (`services/pdf/manual-pdf-test.js`):
- Generates sample PDFs for visual verification
- **Note:** This is a standalone script, not will not run as part of `npm run test`. Its primary purpose is to assist with local development and ensure the fonts within the PDF are rendered correctly. Hence it serves no purpose being part of the pipeline tests
- Uses test data from `resources/testing/polish-chars-test.json` and `resources/testing/diacritic-chars-test.json`
- Run with: `node services/pdf/manual-pdf-test.js`
- Outputs PDFs to `resources/temp/` for manual inspection
