import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, User } from '../firebase';
import { Notebook, Note, Artifact, ChatMessage } from '../types';

export interface UserProfileData {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save or update user profile upon login
 */
export async function syncUserProfile(user: User): Promise<UserProfileData> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userDocRef);
    const now = new Date().toISOString();
    
    let profile: UserProfileData;
    if (!existingSnap.exists()) {
      profile = {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Researcher',
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userDocRef, profile);
    } else {
      const data = existingSnap.data() as UserProfileData;
      profile = {
        userId: user.uid,
        email: user.email || data.email || '',
        displayName: user.displayName || data.displayName || 'Researcher',
        photoURL: user.photoURL || data.photoURL || '',
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      await setDoc(userDocRef, profile, { merge: true });
    }
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Real-time subscription to all notebooks owned by the authenticated user
 */
export function subscribeToUserNotebooks(
  userId: string,
  onData: (notebooks: Notebook[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'notebooks';
  try {
    const q = query(
      collection(db, path),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Notebook[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: data.id || docSnap.id,
            name: data.name,
            repoUrl: data.repoUrl,
            ref: data.ref,
            pathFilter: data.pathFilter,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            indexStatus: data.indexStatus || 'ready',
            indexError: data.indexError,
            source: data.source || {
              repoUrl: data.repoUrl,
              owner: data.name.split('/')[0] || '',
              name: data.name.split('/')[1] || data.name,
              fullName: data.name,
              description: '',
              defaultBranch: data.ref,
              selectedRef: data.ref,
              license: '',
              stars: 0,
              forks: 0,
              openIssues: 0,
              topics: [],
              languages: {},
              primaryLanguage: 'Code',
              avatarUrl: '',
              lastSyncedAt: data.updatedAt,
              isPrivate: false,
              totalFiles: data.files?.length || 0,
              totalLines: 0,
              categoryCounts: { doc: 0, code: 0, config: 0, test: 0, workflow: 0 },
            },
            files: data.files || [],
            chunks: data.chunks || [],
            messages: data.messages || [],
            notes: data.notes || [],
            artifacts: data.artifacts || [],
            pinnedCitations: data.pinnedCitations || [],
            suggestedQuestions: data.suggestedQuestions || [],
          });
        });
        // Sort descending by updatedAt
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Real-time subscription to notes owned by the authenticated user
 */
export function subscribeToUserNotes(
  userId: string,
  notebookId: string | null,
  onData: (notes: Note[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'notes';
  try {
    let q = query(
      collection(db, path),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Note[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!notebookId || data.notebookId === notebookId) {
            list.push({
              id: data.id || docSnap.id,
              notebookId: data.notebookId,
              title: data.title,
              content: data.content,
              tags: data.tags || [],
              citations: data.citations || [],
              sourceMessageId: data.sourceMessageId,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          }
        });
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Real-time subscription to artifacts owned by the authenticated user
 */
export function subscribeToUserArtifacts(
  userId: string,
  notebookId: string | null,
  onData: (artifacts: Artifact[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'artifacts';
  try {
    const q = query(
      collection(db, path),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Artifact[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!notebookId || data.notebookId === notebookId) {
            list.push({
              id: data.id || docSnap.id,
              notebookId: data.notebookId,
              type: data.type,
              title: data.title,
              content: data.content,
              citations: data.citations || [],
              createdAt: data.createdAt,
            });
          }
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Real-time subscription to chat messages for a notebook
 */
export function subscribeToNotebookMessages(
  userId: string,
  notebookId: string,
  onData: (messages: ChatMessage[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'chatMessages';
  try {
    const q = query(
      collection(db, path),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.notebookId === notebookId) {
            list.push({
              id: data.id || docSnap.id,
              role: data.role,
              content: data.content,
              citations: data.citations || [],
              suggestedFollowUps: data.suggestedFollowUps || [],
              answerMode: data.answerMode,
              modelUsed: data.modelUsed,
              confidence: data.confidence,
              createdAt: data.createdAt,
            });
          }
        });
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Persist or update a Notebook in Firestore
 */
export async function saveNotebookToFirestore(userId: string, notebook: Notebook): Promise<void> {
  const path = `notebooks/${notebook.id}`;
  try {
    const docRef = doc(db, 'notebooks', notebook.id);
    const payload = {
      id: notebook.id,
      ownerId: userId,
      name: notebook.name,
      repoUrl: notebook.repoUrl,
      ref: notebook.ref,
      pathFilter: notebook.pathFilter || '',
      createdAt: notebook.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      indexStatus: notebook.indexStatus || 'ready',
      source: notebook.source || {},
      files: notebook.files || [],
      chunks: notebook.chunks || [],
      suggestedQuestions: notebook.suggestedQuestions || [],
      pinnedCitations: notebook.pinnedCitations || [],
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete a Notebook and its associated items from Firestore
 */
export async function deleteNotebookFromFirestore(userId: string, notebookId: string): Promise<void> {
  const path = `notebooks/${notebookId}`;
  try {
    // Delete the notebook doc
    await deleteDoc(doc(db, 'notebooks', notebookId));

    // Also cascade cleanup notes, artifacts, messages
    const notesSnap = await getDocs(
      query(collection(db, 'notes'), where('ownerId', '==', userId))
    );
    const batch = writeBatch(db);
    notesSnap.forEach((d) => {
      if (d.data().notebookId === notebookId) {
        batch.delete(d.ref);
      }
    });

    const artSnap = await getDocs(
      query(collection(db, 'artifacts'), where('ownerId', '==', userId))
    );
    artSnap.forEach((d) => {
      if (d.data().notebookId === notebookId) {
        batch.delete(d.ref);
      }
    });

    const msgSnap = await getDocs(
      query(collection(db, 'chatMessages'), where('ownerId', '==', userId))
    );
    msgSnap.forEach((d) => {
      if (d.data().notebookId === notebookId) {
        batch.delete(d.ref);
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Persist or update a Note in Firestore
 */
export async function saveNoteToFirestore(userId: string, note: Note): Promise<void> {
  const path = `notes/${note.id}`;
  try {
    const docRef = doc(db, 'notes', note.id);
    const payload = {
      id: note.id,
      ownerId: userId,
      notebookId: note.notebookId,
      title: note.title,
      content: note.content,
      tags: note.tags || [],
      citations: note.citations || [],
      sourceMessageId: note.sourceMessageId || '',
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete a Note from Firestore
 */
export async function deleteNoteFromFirestore(userId: string, noteId: string): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Persist an Artifact in Firestore
 */
export async function saveArtifactToFirestore(userId: string, artifact: Artifact): Promise<void> {
  const path = `artifacts/${artifact.id}`;
  try {
    const docRef = doc(db, 'artifacts', artifact.id);
    const payload = {
      id: artifact.id,
      ownerId: userId,
      notebookId: artifact.notebookId,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      citations: artifact.citations || [],
      createdAt: artifact.createdAt || new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete an Artifact from Firestore
 */
export async function deleteArtifactFromFirestore(userId: string, artifactId: string): Promise<void> {
  const path = `artifacts/${artifactId}`;
  try {
    await deleteDoc(doc(db, 'artifacts', artifactId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Persist a single ChatMessage in Firestore
 */
export async function saveChatMessageToFirestore(
  userId: string,
  notebookId: string,
  message: ChatMessage
): Promise<void> {
  const path = `chatMessages/${message.id}`;
  try {
    const docRef = doc(db, 'chatMessages', message.id);
    const payload = {
      id: message.id,
      ownerId: userId,
      notebookId,
      role: message.role,
      content: message.content,
      citations: message.citations || [],
      suggestedFollowUps: message.suggestedFollowUps || [],
      answerMode: message.answerMode || 'detailed',
      modelUsed: message.modelUsed || 'gemini-3.7-flash',
      confidence: message.confidence || 'grounded',
      createdAt: message.createdAt || new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
