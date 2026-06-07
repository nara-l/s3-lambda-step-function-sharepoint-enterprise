import { Handler } from 'aws-lambda';
import { DocumentWorkflowInput, DocumentStatus } from './shared/types';
import { logError } from './shared/logger';
import { trackDocumentState } from './shared/tracking';

interface StepFunctionError {
  Error?: string;
  Cause?: string;
}

// Step Functions sends the original workflow input plus an `error` object here
// because the catch path in CDK uses: resultPath: '$.error'.
interface WorkflowFailureInput extends Partial<DocumentWorkflowInput> {
  department?: string;
  targetSharePointSite?: string;
  targetSharePointPath?: string;
  error?: StepFunctionError;
}

interface WorkflowFailureResult extends WorkflowFailureInput {
  status: DocumentStatus;
  failedAt: string;
  errorMessage: string;
}

function getErrorMessage(error?: StepFunctionError): string {
  if (!error) {
    return 'Workflow failed.';
  }

  if (!error.Cause) {
    return error.Error ?? 'Workflow failed.';
  }

  try {
    // Lambda failures usually put the useful message inside `Cause` as JSON.
    const cause = JSON.parse(error.Cause) as { errorMessage?: string };
    return cause.errorMessage ?? error.Error ?? 'Workflow failed.';
  } catch {
    return error.Cause;
  }
}

export const handler: Handler<
  WorkflowFailureInput,
  WorkflowFailureResult
> = async (event) => {
  // This Lambda is the Step Functions catch handler. Its only job is to make
  // the failure visible in DynamoDB and CloudWatch before the workflow fails.
  const failedAt = new Date().toISOString();
  const errorMessage = getErrorMessage(event.error);

  logError('Workflow failure recorded.', {
    documentId: event.documentId,
    correlationId: event.correlationId,
    errorMessage,
  });

  if (event.documentId && event.correlationId) {
    await trackDocumentState({
      documentId: event.documentId,
      correlationId: event.correlationId,
      status: 'FAILED',
      stepName: 'Workflow Failure',
      s3Bucket: event.s3Bucket,
      s3Key: event.s3Key,
      s3VersionId: event.s3VersionId,
      department: event.department,
      targetSharePointSite: event.targetSharePointSite,
      targetSharePointPath: event.targetSharePointPath,
      errorMessage,
    });
  }

  return {
    ...event,
    status: 'FAILED',
    failedAt,
    errorMessage,
  };
};
