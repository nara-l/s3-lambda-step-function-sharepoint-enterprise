# Learning Workflow

## Goal

Build the project in a way that makes the AWS flow understandable, reviewable, and debuggable. Codex can write code, but each milestone should force the human learner to explain what exists, why it exists, how data moves, and how failure is handled.

## Ground Rule

Do not build the whole system in one pass.

Each milestone should have:

- a plain-English explanation
- a diagram or flow list
- the exact files touched
- the AWS resources created
- one manual test
- one failure test
- one review checklist

If a milestone cannot be explained in five minutes, it is too large.

## Development Style

Use a "read, predict, implement, deploy, inspect" loop.

1. **Read**: inspect the relevant files before changing them.
2. **Predict**: say what should happen when the code runs.
3. **Implement**: make the smallest useful change.
4. **Deploy**: run the AWS deployment yourself.
5. **Inspect**: check AWS Console, CloudWatch logs, Step Functions execution history, and DynamoDB state.

This matters because serverless systems are learned through execution traces, not just source code.

## Milestone 1: Empty CDK Skeleton

Build only the CDK app and stack structure.

You should be able to explain:

- what `bin/app.ts` does
- what `lib/*stack.ts` does
- how CDK turns TypeScript into CloudFormation
- what `cdk synth` produces

Manual proof:

- run `npm test` or a basic TypeScript check
- run `cdk synth`
- inspect the generated CloudFormation

Do not deploy yet if the synthesized template is not understandable at a high level.

## Milestone 2: S3 And DynamoDB Only

Add the source S3 bucket and the document tracking DynamoDB table.

You should be able to explain:

- why S3 is the input boundary
- why DynamoDB uses `documentId` as the partition key
- what fields represent current workflow state
- what fields support retries and idempotency

Manual proof:

- deploy the stack
- find the bucket in AWS Console
- find the table in DynamoDB
- manually add or inspect one test tracking item if needed

Failure test:

- confirm public S3 access is blocked
- confirm resources are named clearly enough to identify

## Milestone 3: S3 Event Handler Starts Step Functions

Add the S3 event Lambda and a minimal state machine.

At this stage, the state machine can have one placeholder Lambda or a pass state.

You should be able to explain:

- what an S3 event looks like
- how the Lambda extracts bucket and key
- how the Lambda calls `StartExecution`
- what input is passed into Step Functions
- why duplicate S3 events matter

Manual proof:

- upload one file to S3
- find the Lambda log
- find the Step Functions execution
- copy the execution input and explain every field

Failure test:

- upload a file with a strange key, such as spaces or nested folders
- confirm logs still show the correct key

## Milestone 4: Validate Document

Add the validation Lambda.

You should be able to explain:

- why it uses S3 `HeadObject`
- what metadata is available before reading the file
- what file types and sizes are allowed
- what happens when validation fails
- how DynamoDB status changes

Manual proof:

- upload a valid file
- upload an invalid file
- compare successful and failed Step Functions executions
- inspect CloudWatch logs
- inspect DynamoDB status

Failure test:

- invalid file extension
- oversized file, if practical
- missing or unexpected content type

## Milestone 5: Resolve Destination

Add routing logic.

You should be able to explain:

- how a department is inferred
- how a SharePoint site/path is selected
- what happens when routing metadata is missing
- why routing belongs before upload

Manual proof:

- upload `finance/test.pdf`
- upload `legal/test.pdf`
- upload `unknown/test.pdf`
- confirm each routes to the expected simulated destination

Failure test:

- force an unknown or unsupported department
- confirm the failure is understandable

## Milestone 6: Simulate SharePoint Upload

Add a fake SharePoint adapter.

You should be able to explain:

- what a real SharePoint upload would need later
- why we hide SharePoint behind an adapter
- why retries can be dangerous for uploads
- how `sharePointUploadId` supports idempotency

Manual proof:

- upload a valid file
- confirm the workflow reaches `COMPLETE`
- confirm DynamoDB records the simulated upload result

Failure test:

- add a controlled simulation failure, for example keys containing `fail-upload`
- confirm the workflow moves to `FAILED`

## Milestone 7: Failure Handling And Retry Rules

Add intentional Step Functions retry and catch behavior.

You should be able to explain:

- which errors are retryable
- which errors are not retryable
- how many attempts are allowed
- where failed documents are visible
- how a human would replay a failed document

Manual proof:

- trigger a retryable fake failure
- watch Step Functions retry it
- confirm `attemptCount` changes

Failure test:

- trigger a validation failure and confirm it does not retry

## Milestone 8: Bulk Start Lambda

Add the bulk action Lambda after the single-document flow works.

You should be able to explain:

- why bulk processing is not the first milestone
- how S3 listing pagination works
- how duplicate processing is avoided
- how concurrency could be controlled later

Manual proof:

- run the bulk Lambda against a small prefix
- confirm it starts multiple executions
- confirm already-processed documents are skipped or handled idempotently

Failure test:

- include one invalid file among valid files
- confirm one failure does not hide the other successful documents

## Milestone 9: Observability

Add structured logs, metrics, and alarms.

You should be able to explain:

- how to find a document by `documentId`
- how to find all logs for one `correlationId`
- how to know where a workflow failed
- what alarm would wake up an operator

Manual proof:

- search CloudWatch logs by `correlationId`
- inspect Step Functions graph view
- query DynamoDB for failed documents

Failure test:

- intentionally fail one execution and trace it from Step Functions to Lambda logs to DynamoDB

## Code Review Routine

Before approving each milestone, answer these questions:

- What event starts this code?
- What input does it expect?
- What output does it return?
- What AWS permissions does it need?
- What state does it write?
- What happens if it runs twice?
- What happens if it fails halfway?
- Where would I look first in AWS to debug it?
- Is the code readable enough that I could explain it tomorrow?

## Deployment Routine

The learner should run deployment commands directly.

Recommended rhythm:

1. Codex makes or proposes the change.
2. Human reads the changed files.
3. Human asks questions before deployment.
4. Human runs `cdk synth`.
5. Human reviews the resource changes.
6. Human runs `cdk deploy`.
7. Human performs the manual AWS Console test.
8. Human explains the trace back in plain English.

This creates real understanding. Deployment is the forcing function, but inspection is where most of the learning happens.

## What Codex Should Do

Codex should:

- keep changes small
- explain the data flow before writing code
- list files changed after every milestone
- provide test commands
- provide AWS Console inspection steps
- ask the learner to explain the trace before moving on

Codex should not:

- generate the whole system at once
- hide failure handling until the end
- skip manual AWS verification
- add abstractions that the learner cannot explain
- copy tutorial code without adapting the business purpose

## Best First Session

Start with Milestone 1 only:

- initialize the TypeScript CDK project
- add a minimal stack
- run `cdk synth`
- explain the generated template

Do not touch Lambda, Step Functions, SharePoint simulation, or DynamoDB until the CDK skeleton makes sense.
