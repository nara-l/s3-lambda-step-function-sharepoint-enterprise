import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentWorkflowInput, ValidationResult } from './shared/types';
import { handler } from './validate-document';
import { trackDocumentState } from './shared/tracking';

vi.mock('./shared/tracking', () => ({
  trackDocumentState: vi.fn(),
}));

vi.mock('./shared/logger', () => ({
  logInfo: vi.fn(),
}));

const baseEvent: DocumentWorkflowInput = {
  documentId: 'doc-1',
  correlationId: 'corr-1',
  s3Bucket: 'source-bucket',
  s3Key: 'finance/report.pdf',
  status: 'RECEIVED',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
};

describe('validate-document handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks supported documents as VALIDATED', async () => {
    const result = await handler(
      { ...baseEvent, s3Key: 'finance/REPORT.PDF' },
      {} as never,
      vi.fn(),
    );
    const validationResult = result as ValidationResult;

    expect(validationResult.status).toBe('VALIDATED');
    expect(trackDocumentState).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        correlationId: 'corr-1',
        status: 'VALIDATED',
        stepName: 'Validate Document',
        s3Key: 'finance/REPORT.PDF',
      }),
    );
  });

  it('writes FAILED before throwing for unsupported files', async () => {
    await expect(
      handler(
        { ...baseEvent, s3Key: 'finance/malware.exe' },
        {} as never,
        vi.fn(),
      ),
    ).rejects.toThrow('Unsupported file extension.');

    expect(trackDocumentState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        stepName: 'Validate Document',
        s3Key: 'finance/malware.exe',
        errorMessage: 'Unsupported file extension.',
      }),
    );
  });
});
