import initSqlJs, { Database } from 'sql.js';
import { Mutex } from 'async-mutex';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Notebook, StorageStats, SourceFile, FileChunk, ChatMessage, Note, Artifact, Citation } from '../src/types';
import { getSampleZustandNotebook } from '../src/sampleRepos';

const DATA_DIR = path.join(process.cwd(), '.reponotebook_data');
const SQLITE_FILE = path.join(DATA_DIR, 'reponotebook.sqlite');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'notebooks.json');

const dbMutex = new Mutex();
let dbInstance: Database | null = null;
let isInitialized = false;

/**
 * Initialize SQLite Database schema and migrate legacy flat JSON if present
 */
export async function getDatabase(): Promise<Database> {
  return await dbMutex.runExclusive(async () => {
    if (dbInstance && isInitialized) {
      return dbInstance;
    }

    if (!fs.existsSync(DATA_DIR)) {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(SQLITE_FILE)) {
      try {
        const fileBuffer = await fsPromises.readFile(SQLITE_FILE);
        if (fileBuffer && fileBuffer.length > 50) {
          dbInstance = new SQL.Database(fileBuffer);
          dbInstance.exec('PRAGMA schema_version;');
        } else {
          dbInstance = new SQL.Database();
        }
      } catch (err) {
        console.warn('[SQLite] Failed to load existing database file, creating fresh DB:', err);
        dbInstance = new SQL.Database();
      }
    } else {
      dbInstance = new SQL.Database();
    }

    const initSchema = (db: Database) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS notebooks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          repo_url TEXT NOT NULL,
          ref TEXT NOT NULL,
          path_filter TEXT,
          index_status TEXT NOT NULL,
          index_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          source_json TEXT NOT NULL,
          suggested_questions_json TEXT
        );

        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          path TEXT NOT NULL,
          language TEXT NOT NULL,
          file_category TEXT NOT NULL,
          size INTEGER NOT NULL,
          line_count INTEGER NOT NULL,
          content TEXT NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          start_line INTEGER NOT NULL,
          end_line INTEGER NOT NULL,
          chunk_type TEXT NOT NULL,
          symbol_name TEXT,
          content TEXT NOT NULL,
          language TEXT NOT NULL,
          file_category TEXT NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          citations_json TEXT,
          suggested_follow_ups_json TEXT,
          created_at TEXT NOT NULL,
          answer_mode TEXT,
          confidence TEXT,
          model_used TEXT,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags_json TEXT,
          citations_json TEXT,
          source_message_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          citations_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pinned_citations (
          id TEXT PRIMARY KEY,
          notebook_id TEXT NOT NULL,
          citation_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_files_notebook ON files(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_notebook ON chunks(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_messages_notebook ON messages(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_notebook ON artifacts(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_pins_notebook ON pinned_citations(notebook_id);
      `);
    };

    try {
      initSchema(dbInstance);
    } catch (schemaErr) {
      console.warn('[SQLite] Recreating fresh in-memory database after schema load issue:', schemaErr);
      dbInstance = new SQL.Database();
      initSchema(dbInstance);
    }

    // Check if database has any notebooks
    const countRes = dbInstance.exec('SELECT COUNT(*) AS total FROM notebooks;');
    const totalCount = countRes[0]?.values[0]?.[0] as number || 0;

    if (totalCount === 0) {
      // Check for legacy JSON migration
      let seedNotebooks: Notebook[] = [];
      if (fs.existsSync(LEGACY_JSON_FILE)) {
        try {
          const raw = await fsPromises.readFile(LEGACY_JSON_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            seedNotebooks = parsed;
            console.log(`[SQLite Migration] Migrating ${seedNotebooks.length} notebooks from legacy JSON to SQLite.`);
          }
        } catch (e) {
          console.warn('[SQLite Migration] Could not parse legacy JSON:', e);
        }
      }

      if (seedNotebooks.length === 0) {
        seedNotebooks = [getSampleZustandNotebook()];
      }

      for (const nb of seedNotebooks) {
        insertNotebookInternal(dbInstance, nb);
      }
      await persistDatabaseToDiskInternal(dbInstance);
    }

    isInitialized = true;
    return dbInstance;
  });
}

/**
 * Flush SQLite binary database to disk atomically with temporary file rename
 */
async function persistDatabaseToDiskInternal(db: Database): Promise<void> {
  const binaryArray = db.export();
  const buffer = Buffer.from(binaryArray);
  const tempFile = `${SQLITE_FILE}.tmp-${Date.now()}`;
  await fsPromises.writeFile(tempFile, buffer);
  await fsPromises.rename(tempFile, SQLITE_FILE);
}

function insertNotebookInternal(db: Database, nb: Notebook): void {
  db.run(
    `INSERT OR REPLACE INTO notebooks (
      id, name, repo_url, ref, path_filter, index_status, index_error, created_at, updated_at, source_json, suggested_questions_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      nb.id,
      nb.name,
      nb.repoUrl,
      nb.ref,
      nb.pathFilter || null,
      nb.indexStatus,
      nb.indexError || null,
      nb.createdAt,
      nb.updatedAt,
      JSON.stringify(nb.source),
      JSON.stringify(nb.suggestedQuestions || []),
    ]
  );

  // Clear existing children for clean replace
  db.run('DELETE FROM files WHERE notebook_id = ?;', [nb.id]);
  db.run('DELETE FROM chunks WHERE notebook_id = ?;', [nb.id]);
  db.run('DELETE FROM messages WHERE notebook_id = ?;', [nb.id]);
  db.run('DELETE FROM notes WHERE notebook_id = ?;', [nb.id]);
  db.run('DELETE FROM artifacts WHERE notebook_id = ?;', [nb.id]);
  db.run('DELETE FROM pinned_citations WHERE notebook_id = ?;', [nb.id]);

  // Insert Files
  if (Array.isArray(nb.files)) {
    for (const f of nb.files) {
      db.run(
        `INSERT OR REPLACE INTO files (id, notebook_id, path, language, file_category, size, line_count, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [f.id, nb.id, f.path, f.language, f.fileCategory, f.size, f.lineCount, f.content]
      );
    }
  }

  // Insert Chunks
  if (Array.isArray(nb.chunks)) {
    for (const c of nb.chunks) {
      db.run(
        `INSERT OR REPLACE INTO chunks (id, notebook_id, file_id, file_path, start_line, end_line, chunk_type, symbol_name, content, language, file_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [c.id, nb.id, c.fileId, c.filePath, c.startLine, c.endLine, c.chunkType, c.symbolName || null, c.content, c.language, c.fileCategory]
      );
    }
  }

  // Insert Messages
  if (Array.isArray(nb.messages)) {
    for (const m of nb.messages) {
      db.run(
        `INSERT INTO messages (id, notebook_id, role, content, citations_json, suggested_follow_ups_json, created_at, answer_mode, confidence, model_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          m.id,
          nb.id,
          m.role,
          m.content,
          JSON.stringify(m.citations || []),
          JSON.stringify(m.suggestedFollowUps || []),
          m.createdAt,
          m.answerMode || null,
          m.confidence || null,
          m.modelUsed || null,
        ]
      );
    }
  }

  // Insert Notes
  if (Array.isArray(nb.notes)) {
    for (const n of nb.notes) {
      db.run(
        `INSERT INTO notes (id, notebook_id, title, content, tags_json, citations_json, source_message_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          n.id,
          nb.id,
          n.title,
          n.content,
          JSON.stringify(n.tags || []),
          JSON.stringify(n.citations || []),
          n.sourceMessageId || null,
          n.createdAt,
          n.updatedAt,
        ]
      );
    }
  }

  // Insert Artifacts
  if (Array.isArray(nb.artifacts)) {
    for (const a of nb.artifacts) {
      db.run(
        `INSERT INTO artifacts (id, notebook_id, type, title, content, citations_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [a.id, nb.id, a.type, a.title, a.content, JSON.stringify(a.citations || []), a.createdAt]
      );
    }
  }

  // Insert Pinned Citations
  if (Array.isArray(nb.pinnedCitations)) {
    for (const p of nb.pinnedCitations) {
      db.run(
        `INSERT INTO pinned_citations (id, notebook_id, citation_json, created_at)
         VALUES (?, ?, ?, ?);`,
        [p.id, nb.id, JSON.stringify(p), new Date().toISOString()]
      );
    }
  }
}

/**
 * Retrieve all notebooks with all relations hydrated
 */
export async function getAllNotebooks(): Promise<Notebook[]> {
  const db = await getDatabase();
  return await dbMutex.runExclusive(async () => {
    const nbQuery = db.exec('SELECT * FROM notebooks ORDER BY updated_at DESC;');
    if (nbQuery.length === 0 || nbQuery[0].values.length === 0) {
      return [getSampleZustandNotebook()];
    }

    const notebooks: Notebook[] = [];

    for (const row of nbQuery[0].values) {
      const [
        id,
        name,
        repoUrl,
        ref,
        pathFilter,
        indexStatus,
        indexError,
        createdAt,
        updatedAt,
        sourceJson,
        suggestedQuestionsJson,
      ] = row as any[];

      const source = JSON.parse(sourceJson);
      const suggestedQuestions = JSON.parse(suggestedQuestionsJson || '[]');

      // Files
      const filesQuery = db.exec(`SELECT id, path, language, file_category, size, line_count, content FROM files WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY path ASC;`);
      const files: SourceFile[] = [];
      if (filesQuery.length > 0) {
        for (const fRow of filesQuery[0].values) {
          files.push({
            id: fRow[0] as string,
            path: fRow[1] as string,
            language: fRow[2] as string,
            fileCategory: fRow[3] as any,
            size: fRow[4] as number,
            lineCount: fRow[5] as number,
            content: fRow[6] as string,
          });
        }
      }

      // Chunks
      const chunksQuery = db.exec(`SELECT id, file_id, file_path, start_line, end_line, chunk_type, symbol_name, content, language, file_category FROM chunks WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY file_path ASC, start_line ASC;`);
      const chunks: FileChunk[] = [];
      if (chunksQuery.length > 0) {
        for (const cRow of chunksQuery[0].values) {
          chunks.push({
            id: cRow[0] as string,
            fileId: cRow[1] as string,
            filePath: cRow[2] as string,
            startLine: cRow[3] as number,
            endLine: cRow[4] as number,
            chunkType: cRow[5] as any,
            symbolName: cRow[6] ? (cRow[6] as string) : undefined,
            content: cRow[7] as string,
            language: cRow[8] as string,
            fileCategory: cRow[9] as any,
          });
        }
      }

      // Messages
      const msgQuery = db.exec(`SELECT id, role, content, citations_json, suggested_follow_ups_json, created_at, answer_mode, confidence, model_used FROM messages WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY created_at ASC;`);
      const messages: ChatMessage[] = [];
      if (msgQuery.length > 0) {
        for (const mRow of msgQuery[0].values) {
          messages.push({
            id: mRow[0] as string,
            role: mRow[1] as any,
            content: mRow[2] as string,
            citations: JSON.parse((mRow[3] as string) || '[]'),
            suggestedFollowUps: JSON.parse((mRow[4] as string) || '[]'),
            createdAt: mRow[5] as string,
            answerMode: (mRow[6] as any) || undefined,
            confidence: (mRow[7] as any) || undefined,
            modelUsed: (mRow[8] as any) || undefined,
          });
        }
      }

      // Notes
      const notesQuery = db.exec(`SELECT id, title, content, tags_json, citations_json, source_message_id, created_at, updated_at FROM notes WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY created_at DESC;`);
      const notes: Note[] = [];
      if (notesQuery.length > 0) {
        for (const nRow of notesQuery[0].values) {
          notes.push({
            id: nRow[0] as string,
            notebookId: id as string,
            title: nRow[1] as string,
            content: nRow[2] as string,
            tags: JSON.parse((nRow[3] as string) || '[]'),
            citations: JSON.parse((nRow[4] as string) || '[]'),
            sourceMessageId: nRow[5] ? (nRow[5] as string) : undefined,
            createdAt: nRow[6] as string,
            updatedAt: nRow[7] as string,
          });
        }
      }

      // Artifacts
      const artQuery = db.exec(`SELECT id, type, title, content, citations_json, created_at FROM artifacts WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY created_at DESC;`);
      const artifacts: Artifact[] = [];
      if (artQuery.length > 0) {
        for (const aRow of artQuery[0].values) {
          artifacts.push({
            id: aRow[0] as string,
            notebookId: id as string,
            type: aRow[1] as any,
            title: aRow[2] as string,
            content: aRow[3] as string,
            citations: JSON.parse((aRow[4] as string) || '[]'),
            createdAt: aRow[5] as string,
          });
        }
      }

      // Pinned Citations
      const pinQuery = db.exec(`SELECT citation_json FROM pinned_citations WHERE notebook_id = '${id.replace(/'/g, "''")}' ORDER BY created_at DESC;`);
      const pinnedCitations: Citation[] = [];
      if (pinQuery.length > 0) {
        for (const pRow of pinQuery[0].values) {
          pinnedCitations.push(JSON.parse(pRow[0] as string));
        }
      }

      notebooks.push({
        id,
        name,
        repoUrl,
        ref,
        pathFilter: pathFilter || undefined,
        indexStatus,
        indexError: indexError || undefined,
        createdAt,
        updatedAt,
        source,
        files,
        chunks,
        messages,
        notes,
        artifacts,
        pinnedCitations,
        suggestedQuestions,
      });
    }

    return notebooks;
  });
}

/**
 * Save / Upsert a single notebook transactionally with mutex concurrency lock
 */
export async function saveNotebook(notebook: Notebook): Promise<void> {
  const db = await getDatabase();
  await dbMutex.runExclusive(async () => {
    db.run('BEGIN TRANSACTION;');
    try {
      insertNotebookInternal(db, notebook);
      db.run('COMMIT;');
      await persistDatabaseToDiskInternal(db);
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }
  });
}

/**
 * Bulk save notebooks transactionally
 */
export async function saveNotebooks(notebooks: Notebook[]): Promise<void> {
  const db = await getDatabase();
  await dbMutex.runExclusive(async () => {
    db.run('BEGIN TRANSACTION;');
    try {
      for (const nb of notebooks) {
        insertNotebookInternal(db, nb);
      }
      db.run('COMMIT;');
      await persistDatabaseToDiskInternal(db);
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }
  });
}

/**
 * Delete a notebook transactionally
 */
export async function deleteNotebook(id: string): Promise<boolean> {
  const db = await getDatabase();
  return await dbMutex.runExclusive(async () => {
    db.run('BEGIN TRANSACTION;');
    try {
      db.run('DELETE FROM files WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM chunks WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM messages WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM notes WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM artifacts WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM pinned_citations WHERE notebook_id = ?;', [id]);
      db.run('DELETE FROM notebooks WHERE id = ?;', [id]);
      db.run('COMMIT;');
      await persistDatabaseToDiskInternal(db);
      return true;
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }
  });
}

/**
 * Get storage statistics and SQLite database metadata
 */
export async function getStorageDiagnostics(): Promise<StorageStats> {
  const db = await getDatabase();
  return await dbMutex.runExclusive(async () => {
    const countTable = (table: string): number => {
      try {
        const res = db.exec(`SELECT COUNT(*) FROM ${table};`);
        return (res[0]?.values[0]?.[0] as number) || 0;
      } catch {
        return 0;
      }
    };

    let size = 0;
    let mtime = new Date();
    try {
      if (fs.existsSync(SQLITE_FILE)) {
        const stat = await fsPromises.stat(SQLITE_FILE);
        size = stat.size;
        mtime = stat.mtime;
      }
    } catch {
      size = 0;
    }

    return {
      totalNotebooks: countTable('notebooks'),
      totalFiles: countTable('files'),
      totalChunks: countTable('chunks'),
      totalMessages: countTable('messages'),
      totalNotes: countTable('notes'),
      totalArtifacts: countTable('artifacts'),
      diskUsageBytes: size,
      storagePath: '.reponotebook_data/reponotebook.sqlite (SQLite Concurrency-Safe)',
      storageType: 'sqlite',
      isDiskAvailable: true,
      lastSavedAt: mtime.toISOString(),
    };
  });
}

/**
 * Get a single notebook by ID
 */
export async function getNotebookById(id: string): Promise<Notebook | null> {
  const notebooks = await getAllNotebooks();
  return notebooks.find((n) => n.id === id) || null;
}
