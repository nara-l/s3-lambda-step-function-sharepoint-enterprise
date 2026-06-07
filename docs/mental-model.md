# Mental Model

## Flow To Remember

```text
S3 upload
  -> S3 bucket event notification
  -> S3EventHandler Lambda runs
  -> Lambda calls Step Functions StartExecution using state machine ARN
  -> Step Functions runs the workflow definition
  -> AWS Console shows the graph execution
```

## Main Idea

Step Functions is not a normal function.

Step Functions is a workflow definition.

Lambda functions do the actual work inside or around that workflow.

## Current Milestone 3 Shape

```text
S3 bucket
  -> ObjectCreated event
  -> S3EventHandler Lambda
  -> StartExecution
  -> State machine
  -> Pass state: Workflow Started
  -> End
```

The current state machine has only one step:

```text
Workflow Started
```

That step is a `Pass` state. It does no business work. It only proves that S3 upload can trigger orchestration.

## Code Map

```text
lib/s3-sharepoint-workflow-stack.ts
  = infrastructure wiring
  = defines S3, Lambda, Step Functions, IAM permissions, event notification

lambda/s3-event-handler.ts
  = runtime behavior
  = receives S3 event and starts Step Functions execution
```

## Permission To Remember

Lambda needs permission to start the state machine:

```text
states:StartExecution
```

CDK adds this with:

```text
documentWorkflowStateMachine.grantStartExecution(s3EventHandler)
```

Without this permission, Lambda would run but fail when calling Step Functions.

## ARN To Remember

Lambda starts a specific state machine by ARN.

CDK passes the state machine ARN to Lambda as an environment variable:

```text
STATE_MACHINE_ARN
```

Runtime flow:

```text
CDK creates state machine
  -> CDK gives ARN to Lambda env var
  -> Lambda reads STATE_MACHINE_ARN
  -> Lambda calls StartExecution
```

## What Comes Next

Current workflow:

```text
Workflow Started
```

Future workflow:

```text
Validate Document
  -> Resolve Destination
  -> Simulate SharePoint Upload
  -> Update DynamoDB
```

Each future step will be a Lambda task in the Step Functions workflow.
