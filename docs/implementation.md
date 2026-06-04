# Implementation Guide

## Purpose

This guide translates the tutorial workflow into our S3 to simulated SharePoint project. The tutorial uses S3, Step Functions, Lambda, DynamoDB, SNS, and a CSV parser. Our project uses the same orchestration pattern, but the business flow is different:

- Tutorial flow: upload CSV -> validate -> extract rows -> transform rows -> store rows in DynamoDB -> send SNS email.
- Our flow: upload document -> validate -> resolve destination -> simulate SharePoint upload -> update DynamoDB tracking record -> optionally notify.

The tutorial is useful because it shows the AWS workflow shape. We should copy the orchestration ideas, not the exact CSV business logic.

Reference tutorial repo:

- `https://github.com/Cloudmancermedia/file-processing-workflow`

Important difference from the tutorial repo:

- The tutorial uses DynamoDB as the final business-data destination for parsed CSV rows.
- Our project uses DynamoDB as the workflow tracking store for document state, retries, failures, and idempotency.

This means the tutorial's CDK and Step Functions structure is useful, but its `data-extraction`, `data-transform`, and `dynamodb-store` Lambdas should not be copied directly. Our equivalents are `resolve-destination`, `simulate-sharepoint-upload`, and `update-document-status`.

## Target Build

The first working version should prove that we can process one S3 object and trace it from start to finish.

1. A user uploads a file to S3.
2. S3 triggers an event Lambda.
3. The event Lambda starts a Step Functions execution.
4. Step Functions calls worker Lambdas in order.
5. Worker Lambdas update DynamoDB as the document moves through the workflow.
6. The SharePoint step is simulated.
7. CloudWatch logs show every major action, input, output, error, and retry.

## Recommended Stack

Use TypeScript, Node.js, and AWS CDK.

This matches the tutorial and keeps the project close to a NodeJS/TypeScript enterprise team workflow. The learning goal is not only to make AWS work; it is to become comfortable reading, reviewing, and approving TypeScript Lambda code.

## Project Structure

Recommended starting structure:

```text
.
+-- bin/
|   +-- app.ts
+-- docs/
|   +-- architecture-plan.md
|   +-- implementation.md
+-- lambda/
|   +-- shared/
|   |   +-- errors.ts
|   |   +-- logger.ts
|   |   +-- types.ts
|   +-- s3-event-handler.ts
|   +-- validate-document.ts
|   +-- resolve-destination.ts
|   +-- simulate-sharepoint-upload.ts
|   +-- update-document-status.ts
|   +-- bulk-start.ts
+-- lib/
|   +-- s3-sharepoint-stack.ts
+-- test/
|   +-- lambda/
+-- package.json
```

The tutorial uses a Lambda layer for `csv-parser`. We probably do not need a Lambda layer at first because our simulated SharePoint version can avoid external runtime dependencies. Add a layer only when there is a real shared dependency that multiple Lambdas need.

## Step 1: Shared Types And Errors

Create shared TypeScript files for workflow inputs, outputs, and failures.

The tutorial starts with `errors.ts` and `types.ts`. We should do the same because Step Functions becomes easier to understand when each Lambda has a clear input and output shape.

Important types:

- `S3DocumentEvent`: bucket, key, optional version id, object size, and content type.
- `DocumentWorkflowInput`: document id, bucket, key, correlation id.
- `ValidationResult`: validation status and file metadata.
- `DestinationResult`: department, target SharePoint site, and target path.
- `SharePointUploadResult`: simulated upload id, upload status, and timestamp.
- `DocumentStatus`: allowed DynamoDB statuses.
- `WorkflowError`: normalized error shape for failed steps.

Important statuses:

- `RECEIVED`
- `VALIDATED`
- `ROUTED`
- `UPLOADING`
- `COMPLETE`
- `FAILED`

## Step 2: S3 Event Handler Lambda

This Lambda receives the raw S3 upload event and starts the Step Functions execution.

Responsibilities:

- Read bucket and key from the S3 event.
- Create a `documentId`.
- Create a `correlationId`.
- Write or update DynamoDB status to `RECEIVED`.
- Start the Step Functions execution.
- Pass the state machine ARN through an environment variable.

Learning focus:

- Understand S3 event shape.
- Understand how one AWS service triggers another.
- Understand why the first Lambda should stay small.
- Understand idempotency because S3 events can be delivered more than once.

## Step 3: Validate Document Lambda

This Lambda checks whether the uploaded object is acceptable.

Responsibilities:

- Call S3 `HeadObject`.
- Check file size.
- Check content type or file extension.
- Confirm required metadata exists if we use metadata for routing.
- Update DynamoDB status to `VALIDATED`.
- Throw a structured error if validation fails.

Example validation rules for version one:

- File must not be empty.
- File must be below a configured maximum size.
- File extension must be one of `.pdf`, `.docx`, `.xlsx`, `.csv`, or `.txt`.

Learning focus:

- Understand S3 metadata.
- Understand Lambda failure behavior.
- Understand Step Functions catch/retry behavior.

## Step 4: Resolve Destination Lambda

The tutorial extracts and transforms CSV data. Our equivalent is routing.

Responsibilities:

- Determine the department or business area.
- Determine the target SharePoint site.
- Determine the target SharePoint folder/path.
- Update DynamoDB status to `ROUTED`.

For the simulation, routing can be simple:

- If key starts with `finance/`, route to a fake Finance site.
- If key starts with `legal/`, route to a fake Legal site.
- Otherwise route to a default site.

Learning focus:

- Understand how business rules fit inside a workflow.
- Understand how metadata flows from one Step Functions task to the next.
- Understand where enterprise routing complexity would live.

## Step 5: Simulate SharePoint Upload Lambda

This Lambda pretends to upload the file to SharePoint.

Responsibilities:

- Read the routed destination from the workflow input.
- Optionally call S3 `GetObject` or only simulate using bucket/key metadata.
- Update DynamoDB status to `UPLOADING`.
- Return a fake SharePoint upload result.
- Update DynamoDB status to `COMPLETE` if successful.

The simulated response should look realistic:

```json
{
  "sharePointUploadId": "sim-sp-123",
  "targetSite": "Finance",
  "targetPath": "/Shared Documents/uploads/report.pdf",
  "uploadedAt": "2026-06-03T12:00:00.000Z"
}
```

Learning focus:

- Understand where external API integration belongs.
- Understand how to isolate SharePoint complexity behind an adapter.
- Understand how retries can be dangerous if an upload is not idempotent.

## Step 6: DynamoDB Tracking

The tutorial stores transformed CSV rows in DynamoDB. Our project uses DynamoDB as a tracking table.

Recommended table design for version one:

- Partition key: `documentId`
- Optional GSI: `status`
- Optional GSI: `correlationId`

Recommended item fields:

- `documentId`
- `s3Bucket`
- `s3Key`
- `s3VersionId`
- `correlationId`
- `executionArn`
- `department`
- `targetSharePointSite`
- `targetSharePointPath`
- `status`
- `stepName`
- `retryCount`
- `errorMessage`
- `createdAt`
- `updatedAt`

Use one DynamoDB table for the first version. This table is the source of truth for each document's current workflow state. It should track enough retry and idempotency information to support controlled replays without adding a second table too early.

Recommended retry and idempotency fields:

- `idempotencyKey`
- `attemptCount`
- `lastAttemptAt`
- `nextRetryAt`
- `failureReason`
- `failureStep`
- `sharePointUploadId`
- `sharePointUploadStatus`

Recommended idempotency key:

```text
s3Bucket + "#" + s3Key + "#" + s3VersionId
```

If S3 versioning is not enabled, use a checksum or ETag where possible. The goal is to avoid processing the same document upload twice just because S3 sends a duplicate event or a retry happens.

Do not create a second DynamoDB table in the MVP unless we need append-only history. A second table becomes useful later if we want to store every attempt or every state transition as an audit trail.

Possible later table split:

- `DocumentWorkflowState`: one item per document, current status, retry counters, routing result, final SharePoint result.
- `DocumentWorkflowEvents`: many items per document, append-only event history such as `RECEIVED`, `VALIDATED`, `FAILED`, `RETRIED`, `COMPLETE`.

For now, CloudWatch plus the main tracking table is enough to learn the workflow. If we later need a durable audit log independent of CloudWatch retention, add the event-history table.

Learning focus:

- Understand state tracking.
- Understand how to find failed documents.
- Understand how to replay or retry a failed document.

## Step 7: Step Functions Workflow

The tutorial chains Lambda tasks together and adds a fail state. We should do the same, but with our document-specific steps.

Workflow:

```text
ValidateDocument
  -> ResolveDestination
  -> SimulateSharePointUpload
  -> MarkComplete
```

Failure path:

```text
Any failed task
  -> MarkFailed
  -> FailState
```

Retry policy:

- Retry transient AWS or network-like failures.
- Do not retry validation failures.
- Use limited retry attempts.
- Use backoff so failures do not overload the system.

Learning focus:

- Understand Step Functions visual execution history.
- Understand how input/output changes at each step.
- Understand retries, catches, and fail states.

## Step 8: CloudWatch Observability

CloudWatch is not only logs. It should help answer operational questions.

Structured logs should include:

- `documentId`
- `correlationId`
- `executionArn`
- `stepName`
- `status`
- `s3Bucket`
- `s3Key`

Useful metrics:

- Documents received.
- Documents completed.
- Documents failed.
- Validation failures.
- Upload simulation failures.
- Average workflow duration.
- Lambda error count.

Useful alarms:

- Any failed Step Functions execution.
- Lambda errors above threshold.
- DynamoDB throttling.
- Workflow duration above expected threshold.

Learning focus:

- Understand how to debug without guessing.
- Understand the difference between logs, metrics, alarms, and traces.
- Understand what an operator needs during an incident.

## Step 9: Bulk Action Lambda

The tutorial starts from one S3 upload event. Our enterprise scenario also needs bulk processing.

Responsibilities:

- List objects from a bucket/prefix.
- Start Step Functions executions for each object.
- Respect concurrency limits.
- Avoid starting duplicate work for already processed documents.

Start simple:

- Accept bucket and prefix as input.
- List a limited number of objects.
- Start executions one by one.
- Log how many were started and skipped.

Enterprise version:

- Use pagination.
- Use batching.
- Use reserved concurrency.
- Use a queue or distributed map if volume is high.
- Add replay controls and operator approval.

## Step 10: Deploy And Test

The tutorial deploys with CDK and then tests by uploading files to S3. We should follow the same style.

Manual tests:

1. Upload a valid small document.
2. Confirm Step Functions execution succeeds.
3. Confirm DynamoDB status becomes `COMPLETE`.
4. Confirm CloudWatch logs include the same `documentId` and `correlationId`.
5. Upload an invalid file type.
6. Confirm validation fails and DynamoDB status becomes `FAILED`.
7. Run the bulk Lambda against a small test prefix.

Code tests:

- Unit test each Lambda handler.
- Unit test routing rules.
- Unit test DynamoDB update payloads.
- Unit test simulated SharePoint adapter.
- Add CDK snapshot or assertion tests for key infrastructure.

## Security Checklist

Minimum security expectations:

- Lambdas only get the IAM permissions they need.
- S3 bucket is encrypted.
- DynamoDB table is encrypted.
- No SharePoint secrets are hardcoded.
- Environment variables contain resource names, not credentials.
- CloudWatch logs do not print sensitive document contents.
- S3 bucket blocks public access.
- Real SharePoint credentials later come from Secrets Manager or an enterprise identity flow.

## Cost And Scale Notes

Version one is for learning and one-document traceability. Still, the implementation should avoid choices that obviously break at scale.

Things to watch:

- Step Functions charges by state transition.
- CloudWatch can become expensive if logs are too verbose.
- DynamoDB hot partitions can happen if keys are poorly designed.
- Lambda concurrency needs limits during bulk runs.
- SharePoint or Microsoft Graph will likely throttle real uploads.
- Large files may need different handling than small files.

## Review Checklist

When reviewing generated or manually written code, check:

- Does every Lambda have a clear single responsibility?
- Is the input/output type clear?
- Is failure handled intentionally?
- Is the DynamoDB status updated at the right time?
- Is the workflow idempotent enough for duplicate events?
- Are logs structured and searchable?
- Are IAM permissions narrow?
- Are tests meaningful, or are they only checking mocks?
- Can a human read the code and explain the workflow?

## First Milestone

The first milestone is complete when:

- CDK deploys the infrastructure.
- Uploading one valid file to S3 starts a Step Functions execution.
- The workflow reaches `COMPLETE`.
- DynamoDB shows the document state.
- CloudWatch logs show the full path using one correlation id.
- Uploading one invalid file reaches a controlled failure path.

At that point, we will have the foundation for adding bulk processing, richer CloudWatch dashboards, and eventually a real SharePoint adapter.
