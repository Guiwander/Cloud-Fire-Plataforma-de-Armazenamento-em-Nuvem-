import { CloudFile, CloudFolder, User, SystemStats, CDNConfig } from '../types';

const DB_NAME = 'CloudFireDB';
const DB_VERSION = 2; // Incremented version for config store

// --- Database Singleton ---
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<void> => {
  if (dbInstance) return Promise.resolve();
  
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Users Store
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'username' });
                userStore.createIndex('id', 'id', { unique: true });
            }

            // Files Store
            if (!db.objectStoreNames.contains('files')) {
                const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                fileStore.createIndex('parentId', 'parentId', { unique: false });
                fileStore.createIndex('ownerId', 'ownerId', { unique: false });
            }

            // Folders Store
            if (!db.objectStoreNames.contains('folders')) {
                const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
                folderStore.createIndex('parentId', 'parentId', { unique: false });
                folderStore.createIndex('ownerId', 'ownerId', { unique: false });
            }

            // Config Store (New)
            if (!db.objectStoreNames.contains('config')) {
                db.createObjectStore('config', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            dbInstance.onversionchange = () => {
                dbInstance?.close();
                dbInstance = null;
            };
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error("DB Error", event);
            reject('Erro ao abrir o banco de dados');
        };
    });
  }
  
  return dbPromise.then(() => {});
};

const getDB = async (): Promise<IDBDatabase> => {
    if (dbInstance) return dbInstance;
    await initDB();
    if (!dbInstance) throw new Error("Database failed to initialize");
    return dbInstance;
}

// --- Generic Helper ---
const getStore = async (storeName: string, mode: IDBTransactionMode) => {
  const db = await getDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

// --- User Operations ---

export const registerUser = async (user: User): Promise<void> => {
    const store = await getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(user);
      req.onsuccess = () => resolve();
      req.onerror = () => reject('Nome de usuário já existe');
    });
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
    try {
        const store = await getStore('users', 'readonly');
        return new Promise((resolve, reject) => {
        const req = store.get(username);
        req.onsuccess = () => {
            const user = req.result as User;
            if (user && user.password === password) {
                if (user.isActive === false) {
                    reject("Conta desativada pelo administrador.");
                } else {
                    resolve(user);
                }
            } else {
                resolve(null);
            }
        };
        req.onerror = () => reject(req.error);
        });
    } catch { return null; }
};

export const updateUserStorage = async (userId: string, bytesToAdd: number): Promise<void> => {
    try {
        const store = await getStore('users', 'readwrite');
        const index = store.index('id');
        
        return new Promise((resolve, reject) => {
            const req = index.get(userId);
            req.onsuccess = () => {
                const user = req.result as User;
                if(user) {
                    user.storageUsed += bytesToAdd;
                    const updateReq = store.put(user);
                    updateReq.onsuccess = () => resolve();
                    updateReq.onerror = () => reject(updateReq.error);
                } else {
                    resolve();
                }
            };
            req.onerror = () => resolve();
        });
    } catch (e) {
        console.error("Failed to update storage stats", e);
    }
}

export const getAllUsers = async (): Promise<User[]> => {
    const store = await getStore('users', 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

export const updateUser = async (user: User): Promise<void> => {
    const store = await getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.put(user);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const deleteUser = async (username: string): Promise<void> => {
    const store = await getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.delete(username);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// --- Config Operations (CDN) ---

export const saveCDNConfig = async (config: CDNConfig): Promise<void> => {
    const store = await getStore('config', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.put({ key: 'cdn', ...config });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getCDNConfig = async (): Promise<CDNConfig | null> => {
    const store = await getStore('config', 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.get('cdn');
        req.onsuccess = () => resolve(req.result ? req.result : { provider: 'local' });
        req.onerror = () => reject(req.error);
    });
};

// --- File Operations ---

export const addFileToDB = async (file: CloudFile): Promise<void> => {
  await updateUserStorage(file.ownerId, file.size);
  const store = await getStore('files', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(file);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getFilesFromDB = async (parentId: string, ownerId: string): Promise<CloudFile[]> => {
    const store = await getStore('files', 'readonly');
    const index = store.index('parentId');
    return new Promise((resolve, reject) => {
        const req = index.getAll(parentId); 
        req.onsuccess = () => {
            const files = req.result as CloudFile[];
            // Filter: Must match owner AND NOT be in trash
            resolve(files ? files.filter(f => f.ownerId === ownerId && !f.isTrashed) : []);
        };
        req.onerror = () => reject(req.error);
    });
};

export const getAllFilesGlobal = async (): Promise<CloudFile[]> => {
    const store = await getStore('files', 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
};

export const getFileContent = async (id: string): Promise<Blob | undefined> => {
    try {
        const store = await getStore('files', 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result?.data);
            req.onerror = () => reject(req.error);
        });
    } catch { return undefined; }
}

export const trashFile = async (id: string): Promise<void> => {
    const store = await getStore('files', 'readwrite');
    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const file = getReq.result as CloudFile;
            if (file) {
                file.isTrashed = true;
                file.trashedAt = new Date().toISOString();
                // Also disable sharing when trashed
                if (file.isShared) file.isShared = false;
                
                const putReq = store.put(file);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            } else {
                resolve(); // File not found, ignore
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

export const restoreFile = async (id: string): Promise<void> => {
    const store = await getStore('files', 'readwrite');
    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const file = getReq.result as CloudFile;
            if (file) {
                file.isTrashed = false;
                file.trashedAt = undefined;
                const putReq = store.put(file);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            } else {
                resolve();
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

export const deleteFileFromDB = async (id: string, ownerId: string, size: number): Promise<void> => {
    await updateUserStorage(ownerId, -size);
    const store = await getStore('files', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// --- Sharing Operations ---

export const updateFileShareStatus = async (fileId: string, isShared: boolean, shareToken?: string): Promise<void> => {
    const store = await getStore('files', 'readwrite');
    return new Promise((resolve, reject) => {
        const getReq = store.get(fileId);
        getReq.onsuccess = () => {
            const file = getReq.result as CloudFile;
            if (file) {
                file.isShared = isShared;
                file.shareToken = shareToken;
                file.shareCreatedAt = isShared ? new Date().toISOString() : undefined;
                const putReq = store.put(file);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            } else {
                reject("Arquivo não encontrado");
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
};

export const getFileByShareToken = async (token: string): Promise<CloudFile | null> => {
    // In a real DB we would use an index. For this demo we iterate.
    const store = await getStore('files', 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.openCursor();
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
                const file = cursor.value as CloudFile;
                // Ensure file is not trashed
                if (file.isShared && file.shareToken === token && !file.isTrashed) {
                    resolve(file);
                    return;
                }
                cursor.continue();
            } else {
                resolve(null);
            }
        };
        req.onerror = () => reject(req.error);
    });
};

// --- Folder Operations ---

export const addFolderToDB = async (folder: CloudFolder): Promise<void> => {
    const store = await getStore('folders', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.add(folder);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getFoldersFromDB = async (parentId: string, ownerId: string): Promise<CloudFolder[]> => {
    const store = await getStore('folders', 'readonly');
    const index = store.index('parentId');
    return new Promise((resolve, reject) => {
        const req = index.getAll(parentId);
        req.onsuccess = () => {
            const folders = req.result as CloudFolder[];
            // Filter: Must match owner AND NOT be in trash
            resolve(folders ? folders.filter(f => f.ownerId === ownerId && !f.isTrashed) : []);
        };
        req.onerror = () => reject(req.error);
    });
};

// --- Trash Management ---

export const getTrashedItems = async (ownerId: string): Promise<{files: CloudFile[], folders: CloudFolder[]}> => {
    // This is expensive in IndexedDB without a specific index on 'isTrashed', so we iterate
    // For a clone app this is acceptable.
    
    // Get Files
    const fileStore = await getStore('files', 'readonly');
    const files = await new Promise<CloudFile[]>((resolve) => {
        const req = fileStore.getAll();
        req.onsuccess = () => {
            const all = req.result as CloudFile[];
            resolve(all.filter(f => f.ownerId === ownerId && f.isTrashed));
        };
    });

    // Get Folders (Simple implementation: We don't do folders in trash for this version to avoid recursion complexity in UI, 
    // but we support the data structure)
    const folderStore = await getStore('folders', 'readonly');
    const folders = await new Promise<CloudFolder[]>((resolve) => {
        const req = folderStore.getAll();
        req.onsuccess = () => {
             const all = req.result as CloudFolder[];
             resolve(all.filter(f => f.ownerId === ownerId && f.isTrashed));
        };
    });

    return { files, folders };
};

export const emptyTrash = async (ownerId: string): Promise<void> => {
    const { files } = await getTrashedItems(ownerId);
    // Delete all trashed files physically
    for (const file of files) {
        await deleteFileFromDB(file.id, ownerId, file.size);
    }
    // We could handle folders here too if we implemented soft delete for them fully
};

// --- Admin Stats ---

export const getSystemStats = async (): Promise<SystemStats> => {
    try {
        // Execute sequentially to avoid "Transaction inactive" errors caused by awaiting in between transaction usage
        
        // 1. Get Users Count
        const totalUsers = await new Promise<number>(async (resolve, reject) => {
             const store = await getStore('users', 'readonly');
             const req = store.count();
             req.onsuccess = () => resolve(req.result);
             req.onerror = () => reject(req.error);
        });

        // 2. Get Files Stats (New transaction)
        const filesData = await new Promise<{count: number, size: number}>(async (resolve, reject) => {
            const store = await getStore('files', 'readonly');
            const req = store.openCursor();
            let count = 0;
            let size = 0;
            req.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if(cursor) {
                    count++;
                    size += (cursor.value as CloudFile).size;
                    cursor.continue();
                } else {
                    resolve({ count, size });
                }
            }
            req.onerror = () => reject(req.error);
        });

        const recentUploads = [
            { name: 'Docs', count: Math.floor(filesData.count * 0.4) },
            { name: 'Imagens', count: Math.floor(filesData.count * 0.3) },
            { name: 'Vídeos', count: Math.floor(filesData.count * 0.1) },
            { name: 'Outros', count: Math.floor(filesData.count * 0.2) },
        ];

        return {
            totalUsers,
            totalFiles: filesData.count,
            totalStorage: filesData.size,
            recentUploads
        };
    } catch (e) {
        console.error("Error getting stats", e);
        return { totalUsers: 0, totalFiles: 0, totalStorage: 0, recentUploads: [] };
    }
}