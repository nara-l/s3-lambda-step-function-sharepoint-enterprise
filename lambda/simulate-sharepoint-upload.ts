import { Handler } from 'aws-lambda';
import { DestinationResult, SharePointUploadResult } from './shared/types';
import { logInfo } from './shared/logger';
import { trackDocumentState } from './shared/tracking';

export const handler: Handler<
  DestinationResult,
  SharePointUploadResult
> = async (event) => {
  const uploadedAt = new Date().toISOString();

  logInfo('Simulated SharePoint upload skeleton executed.', {
    documentId: event.documentId,
    correlationId: event.correlationId,
    targetSharePointSite: event.targetSharePointSite,
  });

  await trackDocumentState({
    documentId: event.documentId,
    correlationId: event.correlationId,
    status: 'COMPLETE',
    stepName: 'Simulate SharePoint Upload',
    s3Bucket: event.s3Bucket,
    s3Key: event.s3Key,
    s3VersionId: event.s3VersionId,
    department: event.department,
    targetSharePointSite: event.targetSharePointSite,
    targetSharePointPath: event.targetSharePointPath,
    sharePointUploadId: `simulated-${event.documentId}`,
    sharePointUploadStatus: 'SIMULATED',
  });

  return {
    ...event,
    status: 'COMPLETE',
    updatedAt: uploadedAt,
    sharePointUploadId: `simulated-${event.documentId}`,
    sharePointUploadStatus: 'SIMULATED',
    uploadedAt,
  };
};
