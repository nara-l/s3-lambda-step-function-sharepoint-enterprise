# Project Tracker

## Goal

Build a recruiter-ready demo of an AWS serverless document workflow:

```text
S3 upload
  -> Lambda
  -> Step Functions
  -> worker Lambdas
  -> DynamoDB state tracking
  -> simulated SharePoint upload
  -> CloudWatch trace
```

Real SharePoint is out of scope. Simulated SharePoint is enough for the demo.

## Current Status

- [x] Repo created
- [x] Milestone 1: TypeScript CDK skeleton
- [x] Milestone 2: S3 bucket and DynamoDB table
- [x] AWS account created
- [x] AWS CLI profile configured
- [x] CDK bootstrapped in `us-east-1`
- [x] First CDK app stack deployed
- [x] S3 bucket verified in AWS Console
- [x] DynamoDB table verified in AWS Console

## Fast Path To Demo

### Milestone 3: Start Workflow From S3

- [x] Add S3 event Lambda to CDK
- [x] Add minimal Step Functions state machine
- [x] S3 upload triggers Lambda
- [x] Lambda starts Step Functions execution
- [x] Verify execution in AWS Console

Goal: prove S3 upload can start orchestration.

Proof run:

```text
Uploaded: s3://s3sharepointworkflowstack-sourcedocumentbucket4748-gv3z8uhwalg1/test/milestone-3.txt
Execution: arn:aws:states:us-east-1:335651423326:execution:DocumentWorkflowStateMachine720A0761-kDm9YAkalxqy:f9284946-fe46-420e-acb2-dca090a0171d
Status: SUCCEEDED
```

### Milestone 4: Worker Lambda Flow

- [x] Wire validation Lambda
- [x] Wire destination routing Lambda
- [x] Wire simulated SharePoint upload Lambda
- [x] Verify Step Functions graph runs end-to-end

Goal: prove document moves through workflow steps.

Proof run:

```text
Uploaded: s3://s3sharepointworkflowstack-sourcedocumentbucket4748-gv3z8uhwalg1/finance/milestone-4.txt
Execution: arn:aws:states:us-east-1:335651423326:execution:DocumentWorkflowStateMachine720A0761-kDm9YAkalxqy:0ab15df3-e4ea-4b82-9b35-2a4b3de37b9c
Final status: COMPLETE
Resolved department: finance
Simulated target site: finance-site
```

### Milestone 5: DynamoDB State Tracking

- [ ] Write `RECEIVED`
- [ ] Write `VALIDATED`
- [ ] Write `ROUTED`
- [ ] Write `COMPLETE`
- [ ] Write `FAILED` on controlled failure
- [ ] Verify item in DynamoDB

Goal: prove traceability and retry/idempotency foundation.

### Milestone 6: Failure And Observability

- [x] Add controlled validation failure
- [ ] Add controlled simulated upload failure
- [x] Add Step Functions retry path for transient Lambda errors
- [x] Add Step Functions catch path
- [x] Catch path writes `FAILED` to DynamoDB
- [ ] Confirm CloudWatch logs include `documentId` and `correlationId`
- [ ] Record where failure appears in Step Functions, Lambda logs, and DynamoDB

Goal: prove we can debug the system.

### Milestone 7: Minimal Upload Portal

- [x] Add API Gateway upload portal
- [x] Add Lambda that creates presigned S3 upload URLs
- [x] Browser uploads directly to private source bucket
- [x] Uploaded file still triggers existing S3 workflow
- [x] Deploy and verify portal URL

Portal URL:

```text
https://0pxnu0ijm5.execute-api.us-east-1.amazonaws.com/prod/
```

Goal: give the demo a simple browser interface without changing the backend workflow.

## Demo Polish

### Optional Upload UI

- [x] Small hosted page for single file upload
- [ ] Multi-file upload support
- [x] Uploads files into S3
- [x] Shows basic upload result

This is useful for recruiter demo polish, but it should not block the AWS workflow.

Simplest version:

```text
local HTML page
  -> presigned S3 upload URL or backend helper
  -> upload file to S3
  -> workflow starts
```

Do not build a full frontend app until the serverless flow works.

### Bulk Simulation

- [ ] Upload 10-20 test files under one prefix
- [ ] Confirm each starts a workflow execution
- [ ] Later add bulk-start Lambda for listing an existing prefix

For the recruiter demo, 10-20 files is enough. Do not start with 100+ files until retry/error handling is visible.

## Recruiter Artifact

Final deliverables:

- [ ] GitHub repo
- [ ] README with architecture diagram
- [ ] 3-5 minute walkthrough video
- [ ] AWS Console screenshots or notes:
  - CloudFormation stack
  - Step Functions execution graph
  - DynamoDB tracking item
  - CloudWatch logs

Suggested video flow:

```text
1. Show architecture diagram
2. Upload a document
3. Show Step Functions execution
4. Show DynamoDB state
5. Show controlled failure/debug trace
6. Explain simulated SharePoint boundary
```

## Timebox

Target remaining build time:

```text
4-6 focused hours
```

Keep each next milestone small. Avoid real SharePoint, auth complexity, and overbuilt UI until the workflow demo is complete.
