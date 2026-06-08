import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentStatus } from './shared/types';
import { handler } from './mark-workflow-failed';
import { trackDocumentState } from './shared/tracking';

vi.mock('./shared/tracking', () => ({
  trackDocumentState: vi.fn(),
}));

vi.mock('./shared/logger', () => ({
  logError: vi.fn(),
}));

interface WorkflowFailureResult {
  status: DocumentStatus;
  failedAt: string;
  errorMessage: string;
}

describe('mark-workflow-failed handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts Lambda errorMessage from Step Functions Cause JSON', async () => {
    const result = await handler(
      {
        documentId: 'doc-1',
        correlationId: 'corr-1',
        s3Bucket: 'source-bucket',
        s3Key: 'finance/report.exe',
        error: {
          Error: 'Error',
          Cause: JSON.stringify({
            errorMessage: 'Unsupported file extension.',
          }),
        },
      },
      {} as never,
      vi.fn(),
    );
    const failureResult = result as WorkflowFailureResult;

    expect(failureResult).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'Unsupported file extension.',
      }),
    );
    expect(trackDocumentState).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        correlationId: 'corr-1',
        status: 'FAILED',
        stepName: 'Workflow Failure',
        errorMessage: 'Unsupported file extension.',
      }),
    );
  });

  it('falls back to plain Cause when Cause is not JSON', async () => {
    const result = await handler(
      {
        documentId: 'doc-1',
        correlationId: 'corr-1',
        error: {
          Error: 'States.TaskFailed',
          Cause: 'plain failure',
        },
      },
      {} as never,
      vi.fn(),
    );
    const failureResult = result as WorkflowFailureResult;

    expect(failureResult.errorMessage).toBe('plain failure');
  });
});
