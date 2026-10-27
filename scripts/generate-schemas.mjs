import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemasDir = path.join(rootDir, 'docs', 'schemas');

const knownClasses = [
  {
    className: 'TokenResponse',
    properties: {
      access_token: { type: 'string' },
      refresh_token: { type: 'string' },
      token_type: { type: 'string', default: 'Bearer' },
      expires_in: { type: 'integer' },
      server_url: { type: 'string' },
      transcoding_server: { type: 'string' },
      video_server: { type: 'string' },
      social_server: { type: 'string' },
      notification_server: { type: 'string' },
      client_server: { type: 'string' },
      chat_server: { type: 'string' },
      assetmanager_server: { type: 'string' }
    }
  },
  {
    className: 'ServicesUrls',
    properties: {
      Main: { type: 'string' },
      Asset: { type: 'string' },
      Transcoding: { type: 'string' },
      Video: { type: 'string' },
      Social: { type: 'string' },
      Notification: { type: 'string' },
      AssetManager: { type: 'string' },
      Chat: { type: 'string' },
      Client: { type: 'string' }
    }
  },
  {
    className: 'SupportedVersions',
    properties: {
      BridgeMinVersion: { type: 'string' },
      BridgeMaxVersion: { type: 'string' },
      FreverMinBuild: { type: 'integer' },
      FreverMaxBuild: { type: 'integer' },
      FreverMinVersion: { type: 'string' },
      FreverMaxVersion: { type: 'string' }
    }
  },
  {
    className: 'AgeConfirmationQuizResponse',
    properties: {
      IsAgeConfirmed: { type: 'boolean' },
      IsRunOutOfQuestions: { type: 'boolean' },
      Questions: { type: 'array', items: { type: 'object' } }
    }
  }
];

export function generateSchemas(dumpCsPath) {
  fs.mkdirSync(schemasDir, { recursive: true });

  const classes = [...knownClasses];

  if (dumpCsPath && fs.existsSync(dumpCsPath)) {
    const text = fs.readFileSync(dumpCsPath, 'utf8');
    const classRegex = /public\s+class\s+([A-Za-z0-9_]+)\s*(?::\s*[A-Za-z0-9_]+)?\s*\{([^}]+)\}/g;
    let match;
    while ((match = classRegex.exec(text)) !== null) {
      const className = match[1];
      const body = match[2];
      const fieldRegex = /public\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*;/g;
      const properties = {};
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const fieldType = fieldMatch[1];
        const fieldName = fieldMatch[2];
        let jsonType = 'string';
        if (/int|long|short|byte/i.test(fieldType)) jsonType = 'integer';
        else if (/bool/i.test(fieldType)) jsonType = 'boolean';
        else if (/float|double|decimal/i.test(fieldType)) jsonType = 'number';
        else if (/List|Array|\[\]/i.test(fieldType)) jsonType = 'array';
        properties[fieldName] = { type: jsonType };
      }
      if (Object.keys(properties).length > 0) {
        classes.push({ className, properties });
      }
    }
  }

  for (const item of classes) {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: item.className,
      type: 'object',
      properties: item.properties
    };
    fs.writeFileSync(
      path.join(schemasDir, `${item.className}.json`),
      JSON.stringify(schema, null, 2) + '\n'
    );
  }

  return classes.length;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const dumpArg = process.argv[2] || null;
  const count = generateSchemas(dumpArg);
  console.log(`Generated ${count} JSON schemas in docs/schemas/`);
}
