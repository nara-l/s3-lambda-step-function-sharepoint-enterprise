import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  Table,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  EventType,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  DefinitionBody,
  Errors,
  Fail,
  StateMachine,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class S3SharePointWorkflowStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceBucket = new Bucket(this, 'SourceDocumentBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [HttpMethods.PUT],
          allowedOrigins: ['*'],
        },
      ],
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const documentWorkflowTable = new Table(this, 'DocumentWorkflowTable', {
      partitionKey: {
        name: 'documentId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const validateDocumentFunction = new NodejsFunction(
      this,
      'ValidateDocumentFunction',
      {
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/validate-document.ts',
        timeout: Duration.seconds(30),
        environment: {
          TABLE_NAME: documentWorkflowTable.tableName,
        },
      },
    );

    const resolveDestinationFunction = new NodejsFunction(
      this,
      'ResolveDestinationFunction',
      {
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/resolve-destination.ts',
        timeout: Duration.seconds(30),
        environment: {
          TABLE_NAME: documentWorkflowTable.tableName,
        },
      },
    );

    const simulateSharePointUploadFunction = new NodejsFunction(
      this,
      'SimulateSharePointUploadFunction',
      {
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/simulate-sharepoint-upload.ts',
        timeout: Duration.seconds(30),
        environment: {
          TABLE_NAME: documentWorkflowTable.tableName,
        },
      },
    );

    const markWorkflowFailedFunction = new NodejsFunction(
      this,
      'MarkWorkflowFailedFunction',
      {
        runtime: Runtime.NODEJS_20_X,
        entry: 'lambda/mark-workflow-failed.ts',
        timeout: Duration.seconds(30),
        environment: {
          TABLE_NAME: documentWorkflowTable.tableName,
        },
      },
    );

    const uploadPortalFunction = new NodejsFunction(this, 'UploadPortalFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/upload-portal.ts',
      timeout: Duration.seconds(30),
      environment: {
        BUCKET_NAME: sourceBucket.bucketName,
      },
    });

    const uploadPortalApi = new RestApi(this, 'UploadPortalApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
    });
    const uploadPortalIntegration = new LambdaIntegration(uploadPortalFunction);
    uploadPortalApi.root.addMethod('GET', uploadPortalIntegration);
    uploadPortalApi.root
      .addResource('upload-url')
      .addMethod('POST', uploadPortalIntegration);

    const validateDocumentTask = new LambdaInvoke(this, 'Validate Document', {
      lambdaFunction: validateDocumentFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: false,
    });

    const resolveDestinationTask = new LambdaInvoke(this, 'Resolve Destination', {
      lambdaFunction: resolveDestinationFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: false,
    });

    const simulateSharePointUploadTask = new LambdaInvoke(
      this,
      'Simulate SharePoint Upload',
      {
        lambdaFunction: simulateSharePointUploadFunction,
        outputPath: '$.Payload',
        retryOnServiceExceptions: false,
      },
    );

    const markWorkflowFailedTask = new LambdaInvoke(this, 'Mark Workflow Failed', {
      lambdaFunction: markWorkflowFailedFunction,
      outputPath: '$.Payload',
      retryOnServiceExceptions: false,
    });

    const workflowFailed = new Fail(this, 'Workflow Failed');
    const failurePath = markWorkflowFailedTask.next(workflowFailed);
    const lambdaTransientErrors = [
      'Lambda.ServiceException',
      'Lambda.AWSLambdaException',
      'Lambda.SdkClientException',
      'Lambda.TooManyRequestsException',
    ];

    [
      validateDocumentTask,
      resolveDestinationTask,
      simulateSharePointUploadTask,
    ].forEach((task) => {
      task.addRetry({
        errors: lambdaTransientErrors,
        interval: Duration.seconds(2),
        maxAttempts: 2,
        backoffRate: 2,
      });
      task.addCatch(failurePath, {
        errors: [Errors.ALL],
        resultPath: '$.error',
      });
    });

    const documentWorkflowStateMachine = new StateMachine(
      this,
      'DocumentWorkflowStateMachine',
      {
        definitionBody: DefinitionBody.fromChainable(
          validateDocumentTask
            .next(resolveDestinationTask)
            .next(simulateSharePointUploadTask),
        ),
      },
    );

    const s3EventHandler = new NodejsFunction(this, 'S3EventHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/s3-event-handler.ts',
      timeout: Duration.seconds(30),
      environment: {
        STATE_MACHINE_ARN: documentWorkflowStateMachine.stateMachineArn,
        TABLE_NAME: documentWorkflowTable.tableName,
      },
    });

    documentWorkflowTable.grantReadWriteData(s3EventHandler);
    documentWorkflowTable.grantReadWriteData(validateDocumentFunction);
    documentWorkflowTable.grantReadWriteData(resolveDestinationFunction);
    documentWorkflowTable.grantReadWriteData(simulateSharePointUploadFunction);
    documentWorkflowTable.grantReadWriteData(markWorkflowFailedFunction);
    sourceBucket.grantPut(uploadPortalFunction);

    documentWorkflowStateMachine.grantStartExecution(s3EventHandler);

    sourceBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(s3EventHandler),
    );

    new CfnOutput(this, 'SourceDocumentBucketName', {
      value: sourceBucket.bucketName,
      description: 'S3 bucket where source documents are uploaded.',
    });

    new CfnOutput(this, 'DocumentWorkflowTableName', {
      value: documentWorkflowTable.tableName,
      description: 'DynamoDB table that tracks document workflow state.',
    });

    new CfnOutput(this, 'DocumentWorkflowStateMachineArn', {
      value: documentWorkflowStateMachine.stateMachineArn,
      description: 'Step Functions state machine started by S3 uploads.',
    });

    new CfnOutput(this, 'UploadPortalUrl', {
      value: uploadPortalApi.url,
      description: 'Small browser upload portal for demo uploads.',
    });
  }
}
