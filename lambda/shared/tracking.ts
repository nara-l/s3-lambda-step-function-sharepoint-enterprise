import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DocumentStatus } from './types';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export interface TrackDocumentStateInput {
  documentId: string;
  correlationId: string;
  status: DocumentStatus;
  stepName: string;
  s3Bucket?: string;
  s3Key?: string;
  s3VersionId?: string;
  department?: string;
  targetSharePointSite?: string;
  targetSharePointPath?: string;
  sharePointUploadId?: string;
  sharePointUploadStatus?: string;
  errorMessage?: string;
}

export async function trackDocumentState(
  input: TrackDocumentStateInput,
): Promise<void> {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error('TABLE_NAME is required.');
  }

  const now = new Date().toISOString();
  const values = {
    ':correlationId': input.correlationId,
    ':status': input.status,
    ':stepName': input.stepName,
    ':updatedAt': now,
    ':createdAt': now,
    ':s3Bucket': input.s3Bucket,
    ':s3Key': input.s3Key,
    ':s3VersionId': input.s3VersionId,
    ':department': input.department,
    ':targetSharePointSite': input.targetSharePointSite,
    ':targetSharePointPath': input.targetSharePointPath,
    ':sharePointUploadId': input.sharePointUploadId,
    ':sharePointUploadStatus': input.sharePointUploadStatus,
    ':errorMessage': input.errorMessage,
  };

  const optionalSets = [
    ['s3Bucket', ':s3Bucket', input.s3Bucket],
    ['s3Key', ':s3Key', input.s3Key],
    ['s3VersionId', ':s3VersionId', input.s3VersionId],
    ['department', ':department', input.department],
    ['targetSharePointSite', ':targetSharePointSite', input.targetSharePointSite],
    ['targetSharePointPath', ':targetSharePointPath', input.targetSharePointPath],
    ['sharePointUploadId', ':sharePointUploadId', input.sharePointUploadId],
    ['sharePointUploadStatus', ':sharePointUploadStatus', input.sharePointUploadStatus],
    ['errorMessage', ':errorMessage', input.errorMessage],
  ]
    .filter(([, , value]) => value !== undefined)
    .map(([field, valueRef]) => `${field} = ${valueRef}`);

  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        documentId: input.documentId,
      },
      UpdateExpression: [
        'SET correlationId = :correlationId',
        '#status = :status',
        'stepName = :stepName',
        'updatedAt = :updatedAt',
        'createdAt = if_not_exists(createdAt, :createdAt)',
        ...optionalSets,
      ].join(', '),
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: values,
    }),
  );
}
