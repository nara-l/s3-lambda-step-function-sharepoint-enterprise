#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { S3SharePointWorkflowStack } from '../lib/s3-sharepoint-workflow-stack';

const app = new App();

new S3SharePointWorkflowStack(app, 'S3SharePointWorkflowStack');
