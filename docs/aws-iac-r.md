# AWS IaC Refresher

## Core Idea

Infrastructure as Code means writing cloud infrastructure as files instead of clicking everything manually in the AWS Console.

For this project, the flow is:

```text
TypeScript CDK code
  -> cdk synth
  -> CloudFormation template
  -> cdk deploy
  -> CloudFormation stack
  -> AWS resources
```

## CloudFormation

CloudFormation is AWS's native infrastructure deployment engine.

You give CloudFormation a template that describes resources:

- S3 bucket
- DynamoDB table
- Lambda function
- IAM role or policy
- Step Functions state machine
- S3 trigger

CloudFormation creates or updates those resources as a stack.

CloudFormation templates are usually JSON or YAML.

## CDK

CDK means Cloud Development Kit.

CDK lets you write infrastructure using a programming language, such as TypeScript, Python, Java, or C#.

In this project, we use TypeScript CDK.

CDK does not skip CloudFormation. CDK generates CloudFormation.

```text
CDK TypeScript = human-friendly infrastructure code
CloudFormation = AWS deployment template
```

Useful commands:

```text
npm run build
npm run synth
cdk deploy
```

`npm run synth` runs `cdk synth`, which previews the CloudFormation template without deploying.

`cdk deploy` sends the synthesized template to AWS CloudFormation and asks AWS to create or update the stack.

## Terraform

Terraform is another Infrastructure as Code tool.

Terraform is not AWS-specific. It can manage AWS, Azure, GCP, Cloudflare, GitHub, and many other systems.

Terraform uses `.tf` files and keeps its own state file to track what it manages.

Terraform flow:

```text
Terraform .tf files
  -> terraform plan
  -> terraform apply
  -> AWS resources
```

Terraform is common in enterprises because it works across many cloud providers.

## SAM

SAM means Serverless Application Model.

SAM is AWS-specific and is mainly used for serverless apps such as:

- Lambda
- API Gateway
- DynamoDB
- Step Functions

SAM is basically a simplified serverless-focused layer on top of CloudFormation.

SAM flow:

```text
SAM template
  -> CloudFormation
  -> AWS resources
```

## Serverless Framework

Serverless Framework is another tool for deploying Lambda/serverless applications.

It is popular for quickly defining serverless apps, especially Lambda and API Gateway.

It is separate from CDK and SAM.

## Pulumi

Pulumi is similar to CDK in that it lets you write infrastructure using programming languages.

Unlike AWS CDK, Pulumi is multi-cloud.

Pulumi flow:

```text
Pulumi code
  -> Pulumi engine/state
  -> cloud resources
```

## Which One Are We Using?

For this project:

```text
TypeScript CDK -> CloudFormation -> AWS
```

Reason:

- The tutorial uses CDK.
- The target project uses NodeJS/TypeScript.
- CDK makes the AWS architecture readable as code.
- CloudFormation still handles the actual AWS deployment.

## Quick Comparison

| Tool | Main Use | AWS Native? | Multi-Cloud? |
| --- | --- | --- | --- |
| CloudFormation | Deploy AWS resources from templates | Yes | No |
| CDK | Write AWS infrastructure in code | Yes, through CloudFormation | Mostly AWS CDK is AWS-focused |
| Terraform | Manage infrastructure across providers | No | Yes |
| SAM | Serverless AWS apps | Yes, through CloudFormation | No |
| Serverless Framework | Serverless apps | No | Some multi-cloud support |
| Pulumi | Infrastructure in programming languages | No | Yes |

## Mental Model

For this project, remember:

```text
CDK is what we write.
CloudFormation is what AWS deploys.
AWS resources are what actually run.
```

When you run `cdk synth`, you are asking:

```text
What CloudFormation template would this CDK code generate?
```

When you run `cdk deploy`, you are asking:

```text
AWS, please apply this CloudFormation stack.
```
