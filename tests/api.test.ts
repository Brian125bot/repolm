import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getDatabase, saveNotebook } from '../server/db';
import { getSampleZustandNotebook } from '../src/sampleRepos';

describe('Server API Endpoints Integration Tests (server.ts)', () => {
  beforeAll(async () => {
    // Ensure DB is initialized
    await getDatabase();
  });

  describe('Health and Storage Diagnostics', () => {
    it('GET /api/health returns 200 and system status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.mode).toBe('local-optimized');
      expect(res.body.storage).toContain('sqlite');
    });

    it('GET /api/storage/status returns storage metrics', async () => {
      const res = await request(app).get('/api/storage/status');
      expect(res.status).toBe(200);
      expect(res.body.storageType).toBe('sqlite');
      expect(typeof res.body.totalNotebooks).toBe('number');
      expect(typeof res.body.totalFiles).toBe('number');
    });

    it('GET /api/storage/notebooks returns notebook list', async () => {
      const res = await request(app).get('/api/storage/notebooks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notebooks)).toBe(true);
    });

    it('POST /api/storage/notebooks saves notebooks array and rejects non-array', async () => {
      const resInvalid = await request(app)
        .post('/api/storage/notebooks')
        .send({ notebooks: 'invalid' });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error).toContain('Expected an array');

      const sample = getSampleZustandNotebook();
      sample.id = 'nb-test-api-save';
      const resValid = await request(app)
        .post('/api/storage/notebooks')
        .send({ notebooks: [sample] });
      expect(resValid.status).toBe(200);
      expect(resValid.body.success).toBe(true);
      expect(resValid.body.count).toBe(1);
    });

    it('DELETE /api/storage/notebooks/:id removes notebook by ID', async () => {
      const sample = getSampleZustandNotebook();
      sample.id = 'nb-test-to-delete';
      await saveNotebook(sample);

      const res = await request(app).delete(`/api/storage/notebooks/${sample.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Local Filesystem Security & Ingestion', () => {
    it('POST /api/local/scan blocks directory traversal with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/local/scan')
        .send({ localPath: '../../../../etc' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/local/scan returns 404 for non-existent safe directory', async () => {
      const res = await request(app)
        .post('/api/local/scan')
        .send({ localPath: 'src/non_existent_folder_xyz' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Directory not found');
    });

    it('POST /api/local/scan scans safe workspace directory successfully', async () => {
      const res = await request(app)
        .post('/api/local/scan')
        .send({ localPath: 'src' });
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
      expect(res.body.totalFiles).toBeGreaterThan(0);
      expect(Array.isArray(res.body.previewFiles)).toBe(true);
    });

    it('POST /api/local/ingest blocks directory traversal with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/local/ingest')
        .send({ localPath: '../../../../var/log' });
      expect(res.status).toBe(403);
    });

    it('POST /api/local/ingest successfully ingests valid local folder', async () => {
      const res = await request(app)
        .post('/api/local/ingest')
        .send({ localPath: 'src/utils', folderName: 'test-utils' });
      expect(res.status).toBe(200);
      expect(res.body.notebook).toBeDefined();
      expect(res.body.files.length).toBeGreaterThan(0);
      expect(res.body.chunks.length).toBeGreaterThan(0);
    });

    it('POST /api/local/upload-folder validates uploaded files array', async () => {
      const resEmpty = await request(app)
        .post('/api/local/upload-folder')
        .send({ uploadedFiles: [] });
      expect(resEmpty.status).toBe(400);

      const resValid = await request(app)
        .post('/api/local/upload-folder')
        .send({
          folderName: 'test-upload',
          uploadedFiles: [
            {
              path: 'index.ts',
              content: 'export const msg = "hello world";',
            },
            {
              path: 'README.md',
              content: '# Test Upload Repository',
            },
          ],
        });
      expect(resValid.status).toBe(200);
      expect(resValid.body.notebook).toBeDefined();
      expect(resValid.body.files).toHaveLength(2);
      expect(resValid.body.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Validation & Ingestion Endpoints', () => {
    it('POST /api/repo/ingest returns 400 when repoUrl is missing', async () => {
      const res = await request(app)
        .post('/api/repo/ingest')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('POST /api/repo/ingest returns 400 for invalid GitHub URLs', async () => {
      const res = await request(app)
        .post('/api/repo/ingest')
        .send({ repoUrl: 'not_a_valid_url' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('POST /api/repo/ingest handles demo repository pmndrs/zustand shortcut', async () => {
      const res = await request(app)
        .post('/api/repo/ingest')
        .send({ repoUrl: 'https://github.com/pmndrs/zustand' });
      expect(res.status).toBe(200);
      expect(res.body.source.fullName).toBe('pmndrs/zustand');
      expect(res.body.files.length).toBeGreaterThan(0);
      expect(res.body.chunks.length).toBeGreaterThan(0);
    });

    it('POST /api/repo/query returns 400 when question or repoSource missing', async () => {
      const res = await request(app)
        .post('/api/repo/query')
        .send({ question: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('POST /api/repo/artifact returns 400 when artifactType missing', async () => {
      const res = await request(app)
        .post('/api/repo/artifact')
        .send({ repoSource: {} });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });
  });
});
