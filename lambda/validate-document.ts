import { Handler } from 'aws-lambda';
import { DocumentWorkflowInput, ValidationResult } from './shared/types';
import { logInfo } from './shared/logger';
import { trackDocumentState } from './shared/tracking';

const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.csv', '.txt'];

function hasAllowedExtension(s3Key: string): boolean {
  return allowedExtensions.some((extension) =>
    s3Key.toLowerCase().endsWith(extension),
  );
}

export const handler: Handler<DocumentWorkflowInput, ValidationResult> = async (
  event,
) => {
  const updatedAt = new Date().toISOString();

  logInfo('Document validation skeleton executed.', {
    documentId: event.documentId,
    correlationId: event.correlationId,
    s3Key: event.s3Key,
  });

  if (!hasAllowedExtension(event.s3Key)) {
    await trackDocumentState({
      documentId: event.documentId,
      correlationId: event.correlationId,
      status: 'FAILED',
      stepName: 'Validate Document',
      s3Bucket: event.s3Bucket,
      s3Key: event.s3Key,
      s3VersionId: event.s3VersionId,
      errorMessage: 'Unsupported file extension.',
    });

    throw new Error('Unsupported file extension.');
  }

  await trackDocumentState({
    documentId: event.documentId,
    correlationId: event.correlationId,
    status: 'VALIDATED',
    stepName: 'Validate Document',
    s3Bucket: event.s3Bucket,
    s3Key: event.s3Key,
    s3VersionId: event.s3VersionId,
  });

  return {
    ...event,
    status: 'VALIDATED',
    updatedAt,
    validation: {
      checkedAt: updatedAt,
      mode: 'SKELETON_ONLY',
    },
  };
};
