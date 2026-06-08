# Workflow Code Map

## Current Flow

```text
S3 upload
  -> S3EventHandler
  -> Step Functions
  -> Validate Document
  -> Resolve Destination
  -> Simulate SharePoint Upload
  -> COMPLETE

Failure path:

```text
Any worker Lambda fails
  -> Step Functions catch
  -> Mark Workflow Failed
  -> DynamoDB status FAILED
  -> Workflow Failed
```

Upload portal path:

```text
Browser page
  -> API Gateway
  -> UploadPortal Lambda creates presigned S3 POST
  -> Browser uploads file directly to S3
  -> Existing S3 workflow starts
```

## 1. S3 Upload Starts Workflow

Runtime file:

```text
lambda/s3-event-handler.ts
```

Handler:

```ts
export const handler: S3Handler = async (event) => { ... }
```

Important call:

```ts
new StartExecutionCommand({
  stateMachineArn,
  input: JSON.stringify(input),
})
```

CDK wiring:

```ts
const s3EventHandler = new NodejsFunction(this, 'S3EventHandler', { ... });

documentWorkflowStateMachine.grantStartExecution(s3EventHandler);

sourceBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(s3EventHandler),
);
```

Meaning:

```text
S3 ObjectCreated event invokes Lambda.
Lambda starts Step Functions execution.
```

## 1A. Browser Upload Portal

Runtime file:

```text
lambda/upload-portal.ts
```

Handler:

```ts
export const handler: APIGatewayProxyHandler = async (event) => { ... }
```

Current behavior:

```text
GET / -> returns small upload page
POST /upload-url -> returns presigned S3 POST fields
Browser POST -> uploads file to private source bucket
```

CDK wiring:

```ts
const uploadPortalApi = new RestApi(this, 'UploadPortalApi', { ... });
const uploadPortalFunction = new NodejsFunction(this, 'UploadPortalFunction', { ... });
sourceBucket.grantPut(uploadPortalFunction);
```

Meaning:

```text
The UI does not call Step Functions.
It only puts a file into S3.
The existing S3 event path does the rest.
```

## 2. Validate Document

Runtime file:

```text
lambda/validate-document.ts
```

Handler:

```ts
export const handler: Handler<DocumentWorkflowInput, ValidationResult> = async (
  event,
) => { ... }
```

Current behavior:

```text
status: RECEIVED -> VALIDATED
```

CDK function:

```ts
const validateDocumentFunction = new NodejsFunction(
  this,
  'ValidateDocumentFunction',
  { entry: 'lambda/validate-document.ts', ... },
);
```

Step Functions task:

```ts
const validateDocumentTask = new LambdaInvoke(this, 'Validate Document', {
  lambdaFunction: validateDocumentFunction,
  outputPath: '$.Payload',
});
```

## 3. Resolve Destination

Runtime file:

```text
lambda/resolve-destination.ts
```

Handler:

```ts
export const handler: Handler<ValidationResult, DestinationResult> = async (
  event,
) => { ... }
```

Current behavior:

```text
finance/* -> finance-site
legal/* -> legal-site
anything else -> general-site
```

CDK function:

```ts
const resolveDestinationFunction = new NodejsFunction(
  this,
  'ResolveDestinationFunction',
  { entry: 'lambda/resolve-destination.ts', ... },
);
```

Step Functions task:

```ts
const resolveDestinationTask = new LambdaInvoke(this, 'Resolve Destination', {
  lambdaFunction: resolveDestinationFunction,
  outputPath: '$.Payload',
});
```

## 4. Simulate SharePoint Upload

Runtime file:

```text
lambda/simulate-sharepoint-upload.ts
```

Handler:

```ts
export const handler: Handler<
  DestinationResult,
  SharePointUploadResult
> = async (event) => { ... }
```

Current behavior:

```text
status: ROUTED -> COMPLETE
sharePointUploadStatus: SIMULATED
```

CDK function:

```ts
const simulateSharePointUploadFunction = new NodejsFunction(
  this,
  'SimulateSharePointUploadFunction',
  { entry: 'lambda/simulate-sharepoint-upload.ts', ... },
);
```

Step Functions task:

```ts
const simulateSharePointUploadTask = new LambdaInvoke(
  this,
  'Simulate SharePoint Upload',
  {
    lambdaFunction: simulateSharePointUploadFunction,
    outputPath: '$.Payload',
  },
);
```

## 5. Workflow Failure Handler

Runtime file:

```text
lambda/mark-workflow-failed.ts
```

Handler:

```ts
export const handler: Handler<WorkflowFailureInput, WorkflowFailureResult> =
  async (event) => { ... }
```

Current behavior:

```text
Step Functions error -> DynamoDB FAILED -> failed execution
```

## 6. Step Functions Chain

CDK file:

```text
lib/s3-sharepoint-workflow-stack.ts
```

Workflow definition:

```ts
definitionBody: DefinitionBody.fromChainable(
  validateDocumentTask
    .next(resolveDestinationTask)
    .next(simulateSharePointUploadTask),
),
```

Meaning:

```text
Validate Document
  -> Resolve Destination
  -> Simulate SharePoint Upload
```

Retry/catch behavior:

```text
Retry transient Lambda service errors.
Catch remaining errors.
Write FAILED.
End execution as failed.
```

## 7. Types

Shared type file:

```text
lambda/shared/types.ts
```

Status movement:

```text
DocumentWorkflowInput: RECEIVED
ValidationResult: VALIDATED
DestinationResult: ROUTED
SharePointUploadResult: COMPLETE
```
