import { APIGatewayProxyHandler } from 'aws-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logInfo } from './shared/logger';

const s3 = new S3Client({});
const bucketName = process.env.BUCKET_NAME;
const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.csv', '.txt'];
const allowedDepartments = ['finance', 'legal', 'general'];

interface UploadUrlRequest {
  fileName?: string;
  contentType?: string;
  department?: string;
}

function response(statusCode: number, body: string, contentType = 'application/json') {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
    },
    body,
  };
}

function hasAllowedExtension(fileName: string): boolean {
  return allowedExtensions.some((extension) =>
    fileName.toLowerCase().endsWith(extension),
  );
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function renderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S3 SharePoint Workflow Upload</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #111827; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    p { color: #4b5563; line-height: 1.5; }
    form { border: 1px solid #d1d5db; padding: 20px; border-radius: 8px; margin-top: 24px; }
    label { display: block; margin: 14px 0 6px; font-weight: 700; }
    input, select, button { font: inherit; }
    input, select { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #9ca3af; border-radius: 6px; }
    button { margin-top: 18px; padding: 10px 14px; border: 0; border-radius: 6px; background: #2563eb; color: white; cursor: pointer; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    pre { margin-top: 20px; padding: 14px; background: #f3f4f6; border-radius: 6px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>S3 SharePoint Workflow Upload</h1>
  <p>Upload a document into S3. The existing Lambda and Step Functions workflow will validate, route, track, and simulate the SharePoint upload.</p>
  <p>Supported demo files: PDF, DOCX, XLSX, CSV, and TXT.</p>

  <form id="uploadForm">
    <label for="department">Department</label>
    <select id="department" name="department">
      <option value="finance">Finance</option>
      <option value="legal">Legal</option>
      <option value="general">General</option>
    </select>

    <label for="file">Document</label>
    <input id="file" name="file" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" required />

    <button id="uploadButton" type="submit">Upload document</button>
  </form>

  <pre id="status">Waiting for upload.</pre>

  <script>
    const form = document.getElementById('uploadForm');
    const button = document.getElementById('uploadButton');
    const statusBox = document.getElementById('status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = document.getElementById('file').files[0];
      const department = document.getElementById('department').value;

      if (!file) return;

      button.disabled = true;
      statusBox.textContent = 'Creating upload URL...';

      try {
        const uploadEndpoint = window.location.pathname.replace(/\\/?$/, '/') + 'upload-url';
        const urlResponse = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            department
          })
        });

        if (!urlResponse.ok) {
          throw new Error(await urlResponse.text());
        }

        const upload = await urlResponse.json();
        statusBox.textContent = 'Uploading to S3...';

        const s3Response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        });

        if (!s3Response.ok) {
          throw new Error('S3 upload failed: ' + s3Response.status);
        }

        statusBox.textContent =
          'Uploaded successfully.\\n\\nS3 key: ' + upload.key +
          '\\n\\nNow check Step Functions, DynamoDB, and CloudWatch.';
      } catch (error) {
        statusBox.textContent = 'Upload failed.\\n\\n' + error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (!bucketName) {
    throw new Error('BUCKET_NAME is required.');
  }

  if (event.httpMethod === 'GET') {
    return response(200, renderPage(), 'text/html');
  }

  if (event.httpMethod !== 'POST' || event.path !== '/upload-url') {
    return response(404, JSON.stringify({ message: 'Not found.' }));
  }

  const request = JSON.parse(event.body ?? '{}') as UploadUrlRequest;
  const fileName = request.fileName?.trim();
  const department = request.department?.trim().toLowerCase() || 'general';

  if (!fileName || !hasAllowedExtension(fileName)) {
    return response(
      400,
      JSON.stringify({ message: 'Allowed file types: pdf, docx, xlsx, csv, txt.' }),
    );
  }

  if (!allowedDepartments.includes(department)) {
    return response(400, JSON.stringify({ message: 'Unknown department.' }));
  }

  const key = `${department}/${Date.now()}-${safeFileName(fileName)}`;
  const contentType = request.contentType || 'application/octet-stream';
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );

  logInfo('Created presigned upload URL.', {
    s3Bucket: bucketName,
    s3Key: key,
    department,
  });

  return response(
    200,
    JSON.stringify({
      bucket: bucketName,
      key,
      uploadUrl,
      expiresInSeconds: 300,
    }),
  );
};
