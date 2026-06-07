import { Handler } from 'aws-lambda';
import { DestinationResult, ValidationResult } from './shared/types';
import { logInfo } from './shared/logger';
import { trackDocumentState } from './shared/tracking';

function resolveDepartment(s3Key: string): string {
  if (s3Key.startsWith('finance/')) {
    return 'finance';
  }

  if (s3Key.startsWith('legal/')) {
    return 'legal';
  }

  return 'general';
}

export const handler: Handler<ValidationResult, DestinationResult> = async (
  event,
) => {
  const department = resolveDepartment(event.s3Key);
  const updatedAt = new Date().toISOString();

  logInfo('Destination resolution skeleton executed.', {
    documentId: event.documentId,
    correlationId: event.correlationId,
    department,
  });

  await trackDocumentState({
    documentId: event.documentId,
    correlationId: event.correlationId,
    status: 'ROUTED',
    stepName: 'Resolve Destination',
    s3Bucket: event.s3Bucket,
    s3Key: event.s3Key,
    s3VersionId: event.s3VersionId,
    department,
    targetSharePointSite: `${department}-site`,
    targetSharePointPath: `/Shared Documents/${event.s3Key}`,
  });

  return {
    ...event,
    status: 'ROUTED',
    updatedAt,
    department,
    targetSharePointSite: `${department}-site`,
    targetSharePointPath: `/Shared Documents/${event.s3Key}`,
  };
};
