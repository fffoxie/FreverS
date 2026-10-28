import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import {
  startBuild,
  listBuilds,
  getBuild,
  buildOutputPath,
  sourceApkPath,
  saveUploadedApk,
  toolReport
} from './apk/build.js';
import { corsHeaders, send, sendError, readJson } from './admin-core.js';

export function apkStatus(res) {
  try {
    const stat = fs.statSync(sourceApkPath());
    return {
      status: 200,
      bytes: send(res, 200, { path: sourceApkPath(), size: stat.size, modified: stat.mtime.toISOString() })
    };
  } catch {
    return { status: 200, bytes: send(res, 200, { path: sourceApkPath(), missing: true }) };
  }
}

export async function uploadApk(req, res) {
  try {
    const saved = await saveUploadedApk(req);
    return { status: 201, bytes: send(res, 201, { uploaded: true, ...saved }) };
  } catch (error) {
    return { status: 400, bytes: sendError(res, 400, error.message) };
  }
}

export async function createBuild(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return { status: 400, bytes: sendError(res, 400, error.message) };
  }
  try {
    const job = await startBuild({ baseUrl: body.baseUrl || config.publicBaseUrl });
    return { status: 202, bytes: send(res, 202, { job: { id: job.id, status: job.status, baseUrl: job.baseUrl } }) };
  } catch (error) {
    return { status: 400, bytes: sendError(res, 400, error.message) };
  }
}

export function buildsList(res) {
  return { status: 200, bytes: send(res, 200, { builds: listBuilds() }) };
}

export function buildDetails(res, id) {
  const job = getBuild(id);
  if (!job) return { status: 404, bytes: sendError(res, 404, 'Build not found') };
  return { status: 200, bytes: send(res, 200, { build: job }) };
}

export function downloadBuild(res, id) {
  const job = getBuild(id);
  const file = buildOutputPath(job);
  if (!job || !file || !fs.existsSync(file)) {
    return { status: 404, bytes: sendError(res, 404, 'Build output not found') };
  }
  const stat = fs.statSync(file);
  res.writeHead(200, {
    ...corsHeaders(),
    'content-type': 'application/vnd.android.package-archive',
    'content-length': stat.size,
    'content-disposition': `attachment; filename="FreverS-${job.baseUrl.replace(/[^a-z0-9]+/gi, '_')}.apk"`
  });
  fs.createReadStream(file).pipe(res);
  return { status: 200, bytes: stat.size };
}

export async function tools(res) {
  return { status: 200, bytes: send(res, 200, await toolReport()) };
}
