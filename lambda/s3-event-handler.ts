import { createHash, randomUUID } from 'crypto';
import { S3Handler } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { DocumentWorkflowInput } from './shared/types';
import { logError, logInfo } from './shared/logger';
import { trackDocumentState } from './shared/tracking';

const stepFunctions = new SFNClient({});

function createDocumentId(bucket: string, key: string, versionId?: string): string {
  const source = `${bucket}#${key}#${versionId ?? 'no-version'}`;
  return createHash('sha256').update(source).digest('hex');
}

export const handler: S3Handler = async (event) => {
  const stateMachineArn = process.env.STATE_MACHINE_ARN;

  if (!stateMachineArn) {
    throw new Error('STATE_MACHINE_ARN is required.');
  }

  const workflowInputs: DocumentWorkflowInput[] = event.Records.map((record) => {
    const now = new Date().toISOString();
    const s3Bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const s3VersionId = record.s3.object.versionId;

    return {
      documentId: createDocumentId(s3Bucket, s3Key, s3VersionId),
      correlationId: randomUUID(),
      s3Bucket,
      s3Key,
      s3VersionId,
      status: 'RECEIVED',
      createdAt: now,
      updatedAt: now,
    };
  });

  logInfo('S3 event received; starting Step Functions executions.', {
    recordCount: workflowInputs.length,
  });

  await Promise.all(
    workflowInputs.map(async (input) => {
      try {
        await trackDocumentState({
          documentId: input.documentId,
          correlationId: input.correlationId,
          status: 'RECEIVED',
          stepName: 'S3EventHandler',
          s3Bucket: input.s3Bucket,
          s3Key: input.s3Key,
          s3VersionId: input.s3VersionId,
        });

        const response = await stepFunctions.send(
          new StartExecutionCommand({
            stateMachineArn,
            input: JSON.stringify(input),
          }),
        );

        logInfo('Step Functions execution started.', {
          documentId: input.documentId,
          correlationId: input.correlationId,
          executionArn: response.executionArn,
        });
      } catch (error) {
        logError('Failed to start Step Functions execution.', {
          documentId: input.documentId,
          correlationId: input.correlationId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),
  );
};
