import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: mocks.from,
  },
  UpdateCommand: class UpdateCommand {
    constructor(public readonly input: unknown) {}
  },
}));

describe('trackDocumentState', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ send: mocks.send });
    delete process.env.TABLE_NAME;
  });

  it('requires TABLE_NAME', async () => {
    const { trackDocumentState } = await import('./tracking');

    await expect(
      trackDocumentState({
        documentId: 'doc-1',
        correlationId: 'corr-1',
        status: 'RECEIVED',
        stepName: 'S3EventHandler',
      }),
    ).rejects.toThrow('TABLE_NAME is required.');
  });

  it('updates the document item with required and optional fields', async () => {
    process.env.TABLE_NAME = 'DocumentWorkflowTable';
    const { trackDocumentState } = await import('./tracking');

    await trackDocumentState({
      documentId: 'doc-1',
      correlationId: 'corr-1',
      status: 'ROUTED',
      stepName: 'Resolve Destination',
      s3Bucket: 'source-bucket',
      s3Key: 'finance/report.pdf',
      department: 'finance',
    });

    const command = mocks.send.mock.calls[0][0];

    expect(command.input).toEqual(
      expect.objectContaining({
        TableName: 'DocumentWorkflowTable',
        Key: {
          documentId: 'doc-1',
        },
        ExpressionAttributeNames: {
          '#status': 'status',
        },
      }),
    );
    expect(command.input.UpdateExpression).toContain('#status = :status');
    expect(command.input.UpdateExpression).toContain(
      'createdAt = if_not_exists(createdAt, :createdAt)',
    );
    expect(command.input.UpdateExpression).toContain('department = :department');
    expect(command.input.ExpressionAttributeValues).toEqual(
      expect.objectContaining({
        ':correlationId': 'corr-1',
        ':status': 'ROUTED',
        ':stepName': 'Resolve Destination',
        ':s3Bucket': 'source-bucket',
        ':s3Key': 'finance/report.pdf',
        ':department': 'finance',
      }),
    );
  });
});
