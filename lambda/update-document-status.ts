import { Handler } from 'aws-lambda';
import { WorkflowStatusUpdate } from './shared/types';
import { logInfo } from './shared/logger';

export const handler: Handler<
  WorkflowStatusUpdate,
  WorkflowStatusUpdate
> = async (event) => {
  const updatedAt = new Date().toISOString();

  logInfo('Document status update skeleton executed; DynamoDB is not wired yet.', {
    documentId: event.documentId,
    correlationId: event.correlationId,
    status: event.status,
    stepName: event.stepName,
  });

  return {
    ...event,
    updatedAt,
  };
};
