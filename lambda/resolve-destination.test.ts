import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationResult } from './shared/types';
import { handler } from './resolve-destination';
import { trackDocumentState } from './shared/tracking';

vi.mock('./shared/tracking', () => ({
  trackDocumentState: vi.fn(),
}));

vi.mock('./shared/logger', () => ({
  logInfo: vi.fn(),
}));

const baseEvent: ValidationResult = {
  documentId: 'doc-1',
  correlationId: 'corr-1',
  s3Bucket: 'source-bucket',
  s3Key: 'finance/report.pdf',
  status: 'VALIDATED',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
  validation: {
    checkedAt: '2026-06-08T00:00:00.000Z',
    mode: 'SKELETON_ONLY',
  },
};

describe('resolve-destination handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['finance/report.pdf', 'finance', 'finance-site'],
    ['legal/contract.pdf', 'legal', 'legal-site'],
    ['misc/readme.txt', 'general', 'general-site'],
  ])('routes %s to %s', async (s3Key, department, site) => {
    const result = await handler(
      { ...baseEvent, s3Key },
      {} as never,
      vi.fn(),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ROUTED',
        department,
        targetSharePointSite: site,
        targetSharePointPath: `/Shared Documents/${s3Key}`,
      }),
    );
    expect(trackDocumentState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ROUTED',
        stepName: 'Resolve Destination',
        department,
        targetSharePointSite: site,
        targetSharePointPath: `/Shared Documents/${s3Key}`,
      }),
    );
  });
});
