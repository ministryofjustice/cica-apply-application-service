#pip install localstack

init:
	docker run --name localstack -p 4566:4566 -e DEFAULT_REGION=eu-west-2 localstack/localstack

start:
	docker start localstack

create-bucket:
	aws --endpoint-url=http://localhost:4566 s3 mb s3://application-bucket

create-queues:
	aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name application-queue
	aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name tempus-queue

upload-json:
	aws --endpoint-url=http://localhost:4566 s3api put-object --bucket application-bucket --key "testJson.json" --body "./resources/testing/checkYourAnswers.json" --content-type=application/json

send-message:
	aws --endpoint-url=http://localhost:4566 sqs send-message --queue-url "http://localhost:4566/000000000000/application-queue" --message-body "{\"applicationJSONDocumentSummaryKey\": \"testJson.json\"}"

send-regenerate-message:
	aws --endpoint-url=http://localhost:4566 sqs send-message --queue-url "http://localhost:4566/000000000000/application-queue" --message-body "{\"applicationJSONDocumentSummaryKey\": \"testJson.json\", \"regeneratePdf\": true}"

purge-queue:
	aws --endpoint-url=http://localhost:4566 sqs purge-queue --queue-url "http://localhost:4566/000000000000/application-queue"

list-objects:
	aws --endpoint-url=http://localhost:4566 s3api list-objects-v2 --bucket application-bucket

poll-tempus:
	aws --endpoint-url=http://localhost:4566 sqs receive-message --queue-url "http://localhost:4566/000000000000/tempus-queue" --max-number-of-messages 10