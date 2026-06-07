export type DocumentStatus =
  | 'RECEIVED'
  | 'VALIDATED'
  | 'ROUTED'
  | 'UPLOADING'
  | 'COMPLETE'
  | 'FAILED';

export interface DocumentWorkflowInput {
  documentId: string;
  correlationId: string;
  s3Bucket: string;
  s3Key: string;
  s3VersionId?: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult extends DocumentWorkflowInput {
  status: 'VALIDATED';
  validation: {
    checkedAt: string;
    mode: 'SKELETON_ONLY';
  };
}

export interface DestinationResult extends Omit<ValidationResult, 'status'> {
  status: 'ROUTED';
  department: string;
  targetSharePointSite: string;
  targetSharePointPath: string;
}

export interface SharePointUploadResult
  extends Omit<DestinationResult, 'status'> {
  status: 'COMPLETE';
  sharePointUploadId: string;
  sharePointUploadStatus: 'SIMULATED';
  uploadedAt: string;
}

export interface WorkflowStatusUpdate {
  documentId: string;
  correlationId: string;
  status: DocumentStatus;
  stepName: string;
  updatedAt: string;
  errorMessage?: string;
}
