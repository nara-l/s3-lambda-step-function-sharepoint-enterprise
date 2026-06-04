# Milestone 1: CDK Skeleton

## What We Built

This milestone creates the minimum TypeScript AWS CDK project structure. It does not create any application AWS resources yet.

Files added:

- `package.json`: npm scripts and dependencies.
- `package-lock.json`: exact installed dependency versions.
- `.gitignore`: ignores dependencies, CDK output, and generated TypeScript artifacts.
- `cdk.json`: tells CDK how to run the app.
- `tsconfig.json`: TypeScript compiler settings.
- `bin/app.ts`: CDK application entrypoint.
- `lib/s3-sharepoint-workflow-stack.ts`: empty stack class where AWS resources will be added later.

## How The Code Flows

`cdk.json` points CDK to this command:

```text
npx ts-node --prefer-ts-exts bin/app.ts
```

That command runs `bin/app.ts`. The app file creates a CDK `App`, then creates one stack:

```text
S3SharePointWorkflowStack
```

The stack currently extends CDK's `Stack` class, but it does not define any S3 buckets, DynamoDB tables, Lambda functions, or Step Functions state machines yet.

## What CDK Synth Proved

`npm run synth` successfully produced a CloudFormation template.

Because the stack is empty, the template only contains CDK metadata and bootstrap information. That is expected for this milestone.

This proves:

- Node and TypeScript are working.
- CDK can load the app.
- CDK can instantiate the stack.
- The project is ready for the first real AWS resources in Milestone 2.

## Commands Run

```text
npm.cmd install
npm.cmd run build
npm.cmd run synth
```

PowerShell blocked the `npm.ps1` shim on this machine, so `npm.cmd` was used instead. This avoids changing the Windows execution policy.

## Dependency Note

`npm audit` reports one moderate advisory in `brace-expansion`, bundled inside `aws-cdk-lib`. Running `npm.cmd audit fix` could not resolve it automatically because the vulnerable package is bundled by CDK.

This does not block the skeleton milestone, but we should check again before deployment milestones and update CDK when AWS publishes a fixed package.

## Repo Hygiene

`tsconfig.json` uses `noEmit: true`, so `npm run build` type-checks the TypeScript source without generating `.js` and `.d.ts` files beside the source.

`cdk synth` still writes generated CloudFormation output to `cdk.out/`, but that folder is ignored.

## What You Should Be Able To Explain

- `bin/app.ts` is the CDK entrypoint.
- `lib/s3-sharepoint-workflow-stack.ts` is where AWS resources will be declared.
- `cdk synth` turns the CDK app into a CloudFormation template.
- The current template has no S3, DynamoDB, Lambda, or Step Functions resources because we have not added them yet.

## Next Milestone

Milestone 2 should add only:

- one S3 source bucket
- one DynamoDB document workflow tracking table

Do not add Lambda or Step Functions until those two resources are understood.
