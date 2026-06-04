# S3 to SharePoint Orchestration: Architecture Plan

## Goal

Build a learning-focused enterprise-style workflow that moves documents from Amazon S3 toward SharePoint using AWS Lambda, Step Functions, DynamoDB, and CloudWatch. The first version should simulate the SharePoint integration so we can focus on orchestration, tracing, state management, failure handling, and code readability before getting blocked by real SharePoint authentication and API details.

## High-Level Architecture

An actor or upstream system uploads a document to S3. That upload can trigger a Lambda directly, or a separate bulk action Lambda can scan a bucket/prefix and start work for many files. Each document becomes one tracked job. The orchestrator starts an AWS Step Functions state machine, which calls worker Lambdas for each major stage:

1. Validate the incoming S3 object and required metadata.
2. Resolve routing metadata, such as department, document type, or SharePoint destination.
3. Upload the file to a simulated SharePoint adapter.
4. Update DynamoDB with the final state and trace information.

DynamoDB stores the lifecycle state for each document so we can answer: what happened, where did it fail, when did it fail, and whether it can be retried. CloudWatch captures Lambda logs, Step Function execution logs, metrics, and alarms. The system should make one-document flows easy to inspect while still documenting how it would scale to bulk enterprise migration.

## Core Components

- **S3 bucket**: Source location for documents.
- **S3 event Lambda**: Starts a workflow when a new object arrives.
- **Bulk action Lambda**: Lists S3 objects and starts workflows in batches for backfill or replay.
- **Step Functions state machine**: Coordinates the workflow and makes each stage visible.
- **Worker Lambdas**: Small functions responsible for validation, routing, simulated upload, and state updates.
- **DynamoDB table**: Tracks document status, retry count, errors, timestamps, and routing details.
- **SharePoint adapter**: Initially simulated. Later replaced with real Microsoft Graph or SharePoint API calls.
- **CloudWatch**: Logs, metrics, dashboards, and alarms for failures, latency, retries, and throughput.

## DynamoDB Tracking Model

Recommended starting fields:

- `documentId`
- `s3Bucket`
- `s3Key`
- `department`
- `targetSharePointSite`
- `targetSharePointPath`
- `status`: `RECEIVED`, `VALIDATED`, `ROUTED`, `UPLOADING`, `COMPLETE`, `FAILED`
- `stepName`
- `executionArn`
- `retryCount`
- `errorMessage`
- `createdAt`
- `updatedAt`

For enterprise scale, use an idempotency key derived from bucket, key, version, and checksum if available. This prevents duplicate processing when S3 events or retries happen more than once.

## TypeScript vs Python Decision

For this project, use **TypeScript on Node.js** if the goal is to learn the workflow used by the target team. That gives practice reading, reviewing, and approving code in the same language and ecosystem the team likely uses.

Python would be a strong choice for a personal AWS prototype because Boto3 is mature and Python Lambdas are straightforward. But since the learning goal includes joining or understanding a NodeJS/TypeScript enterprise codebase, TypeScript is the better default. The important learning is not just syntax; it is how the team structures handlers, types events, validates payloads, tests Lambdas, deploys infrastructure, and debugs production flows.

## Learning Path

1. Draw and explain the flow in plain English.
2. Define the DynamoDB state model and status transitions.
3. Build a simulated one-document flow locally or as deployable AWS code.
4. Add Step Functions orchestration.
5. Add bulk trigger behavior.
6. Add CloudWatch logs, metrics, dashboard, and alarms.
7. Add failure scenarios and retries.
8. Replace simulated SharePoint with a real adapter only after the orchestration is understood.

## Enterprise Concerns To Discuss Early

- **Security**: IAM least privilege, encrypted S3 and DynamoDB, secret storage, no credentials in Lambda env vars, audit logs, private networking where required.
- **Scale**: S3 event duplication, Step Function concurrency, Lambda reserved concurrency, DynamoDB hot partitions, batch sizing, backpressure, retries, and dead-letter handling.
- **Reliability**: Idempotency, retry policies, failure states, replay strategy, partial failure handling, and clear operator visibility.
- **Cost**: Step Function transition cost, Lambda duration, DynamoDB capacity, CloudWatch log volume, and SharePoint/API throttling behavior.
- **Observability**: Correlation IDs, structured logs, execution ARNs, metrics by status, dashboards, and alarms.
- **Testing**: Unit tests for workers, contract tests for event shapes, integration tests for the state machine, and manual API testing when needed.
- **Code Review**: Review for correctness, security, idempotency, observability, error handling, test coverage, and whether generated code is understandable.

## What We Need Later

We have enough information to start the planning and prototype. Before implementing the real integration, we will need:

- Expected S3 bucket and object naming pattern.
- Required document metadata and routing rules.
- Whether SharePoint upload uses Microsoft Graph, SharePoint REST, or an internal enterprise API.
- Authentication model for SharePoint.
- Expected volume, file sizes, and latency expectations.
- Required retention, audit, and compliance constraints.
- Preferred infrastructure tool: AWS SAM, CDK, Terraform, or Serverless Framework.

## Recommended First Implementation

Start with a TypeScript AWS CDK project that defines S3, DynamoDB, Lambda functions, Step Functions, and CloudWatch basics. Keep SharePoint as a fake adapter that records a successful upload response. The first useful milestone is not "move a real file to SharePoint"; it is "given one S3 object, can we trace the complete workflow and explain every state transition and failure path?"
