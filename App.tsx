import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, Upload, Plus, Search, LogOut, 
  ChevronRight, ArrowLeft, Loader2, Download, Trash2, 
  User as UserIcon, Lock, Mail, X, CheckCircle,
  Play, Share2, Copy, Globe, Settings, Users, HardDrive, Shield, CreditCard, Save,
  Server, Cloud, Database, ToggleLeft, ToggleRight, FileText, AlertCircle, RefreshCw
} from 'lucide-react';
import { FileIcon } from './components/FileIcon';
import { AdminChart } from './components/AdminChart';
import { CloudFile, CloudFolder, User, FileType, SystemStats, CDNConfig } from './types';
import { 
    initDB, registerUser, loginUser, addFileToDB, 
    getFilesFromDB, getFoldersFromDB, addFolderToDB, 
    deleteFileFromDB, getSystemStats, getFileContent,
    updateFileShareStatus, getFileByShareToken,
    getAllUsers, updateUser, deleteUser, getAllFilesGlobal,
    saveCDNConfig, getCDNConfig,
    trashFile, restoreFile, getTrashedItems, emptyTrash
} from './utils/db';

// --- Helper Functions ---
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileType = (mimeType: string): FileType => {
  if (mimeType.startsWith('image/')) return FileType.IMAGE;
  if (mimeType.startsWith('video/')) return FileType.VIDEO;
  if (mimeType.startsWith('audio/')) return FileType.AUDIO;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) return FileType.DOCUMENT;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return FileType.ARCHIVE;
  return FileType.UNKNOWN;
};

const translateFileType = (type: FileType): string => {
  switch (type) {
    case FileType.IMAGE: return 'Imagem';
    case FileType.VIDEO: return 'Vídeo';
    case FileType.AUDIO: return 'Áudio';
    case FileType.DOCUMENT: return 'Documento';
    case FileType.ARCHIVE: return 'Arquivo Compactado';
    default: return 'Desconhecido';
  }
};

// --- Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' }> = ({ 
  children, className = '', variant = 'primary', ...props 
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100"
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Footer = () => (
  <footer className="py-8 text-center text-slate-400 text-xs font-medium w-full mt-auto opacity-70 hover:opacity-100 transition-opacity">
    <p>CloudFire © {new Date().getFullYear()} - Armazenamento Seguro</p>
    <p className="mt-2 text-slate-500">Feito com <span className="text-red-500">❤️</span> por Guilherme Wander</p>
  </footer>
);

export default function App() {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [view, setView] = useState<'login' | 'dashboard' | 'admin' | 'shared' | 'profile' | 'trash'>('login');
  
  // Admin Sub-views
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'files' | 'config'>('overview');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminFiles, setAdminFiles] = useState<CloudFile[]>([]);
  const [cdnConfig, setCdnConfig] = useState<CDNConfig>({ provider: 'local', rootPath: 'public/content' });
  const [configSaved, setConfigSaved] = useState(false);

  // Auth Form State
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');

  // File System State
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Admin State
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  // UI State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  
  // Sharing UI
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // Shared View State
  const [sharedFile, setSharedFile] = useState<CloudFile | null>(null);
  const [sharedError, setSharedError] = useState('');
  
  // Preview States
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---
  useEffect(() => {
    initDB().then(async () => {
      // Force Create/Update default admin user
      const adminUser: User = {
        id: 'admin',
        username: 'admin',
        password: 'password', // Default admin credentials
        email: 'admin@cloudfire.com',
        role: 'admin',
        plan: 'enterprise',
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff',
        storageUsed: 0,
        storageLimit: 100 * 1024 * 1024 * 1024,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      try {
          await registerUser(adminUser);
      } catch (e) {
          await updateUser(adminUser);
      }

      // Check for Share Link
      const params = new URLSearchParams(window.location.search);
      const shareToken = params.get('share');
      if (shareToken) {
          setView('shared');
          setIsLoadingPreview(true);
          try {
             const file = await getFileByShareToken(shareToken);
             if (file) {
                 setSharedFile(file);
                 const blob = await getFileContent(file.id);
                 if (blob) {
                     setPreviewUrl(URL.createObjectURL(blob));
                 }
             } else {
                 setSharedError('Arquivo não encontrado ou link expirado.');
             }
          } catch (e) {
              setSharedError('Erro ao carregar arquivo compartilhado.');
          } finally {
              setIsLoadingPreview(false);
          }
      } else {
          // Only check session if not accessing a shared link
          const savedUserId = localStorage.getItem('cloudfire_user');
          if (savedUserId) {
              try {
                  const users = await getAllUsers();
                  const found = users.find(u => u.id === savedUserId);
                  if (found && found.isActive) {
                      setUser(found);
                      setView(found.role === 'admin' ? 'admin' : 'dashboard');
                  }
              } catch (e) {
                  console.error("Session restore failed", e);
              }
          }
      }

      // Load Config
      const conf = await getCDNConfig();
      if (conf) {
          setCdnConfig({
              ...conf,
              rootPath: conf.rootPath || 'public/content' // Default
          });
      }
    });
  }, []);

  // --- Data Loading ---
  const loadContent = async (folderId: string) => {
    if (!user) return;
    setIsLoadingFiles(true);
    try {
      if (view === 'trash') {
        // Load Trash
        const { files: trashedFiles } = await getTrashedItems(user.id);
        setFiles(trashedFiles);
        setFolders([]); // We only support trashed files display for now
      } else {
        // Load Normal Dashboard Content
        const fetchedFolders = await getFoldersFromDB(folderId, user.id);
        const fetchedFiles = await getFilesFromDB(folderId, user.id);
        setFiles(fetchedFiles);
        setFolders(fetchedFolders);
      }
    } catch (error) {
      console.error("Failed to load content", error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (user && (view === 'dashboard' || view === 'trash')) {
      loadContent(currentFolderId);
    }
  }, [user, currentFolderId, view]);

  // Handle Preview Loading
  useEffect(() => {
      // Only load logic if dashboard/trash view and a file is selected (not shared view)
      if ((view === 'dashboard' || view === 'trash') && selectedFile) {
          setIsLoadingPreview(true);
          setPreviewUrl(null);
          
          const loadPreview = async () => {
              try {
                  const blob = await getFileContent(selectedFile.id);
                  if (blob) {
                      const url = URL.createObjectURL(blob);
                      setPreviewUrl(url);
                  }
              } catch (e) {
                  console.error("Failed to load preview", e);
              } finally {
                  setIsLoadingPreview(false);
              }
          };
          
          // Only load preview for media types
          if ([FileType.IMAGE, FileType.VIDEO, FileType.AUDIO].includes(selectedFile.type)) {
              loadPreview();
          } else {
              setIsLoadingPreview(false);
          }
      } else if (view === 'dashboard' || view === 'trash') {
          if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
          setIsLoadingPreview(false);
      }
      
      return () => {
           if ((view === 'dashboard' || view === 'trash') && previewUrl) URL.revokeObjectURL(previewUrl);
      };
  }, [selectedFile, view]);

  // Load Admin Stats & Data
  useEffect(() => {
    let isMounted = true;
    const fetchAdminData = async () => {
        if (view === 'admin' && user?.role === 'admin') {
            try {
                if (adminTab === 'overview') {
                    const stats = await getSystemStats();
                    if (isMounted) setSystemStats(stats);
                }
                else if (adminTab === 'users') {
                    const users = await getAllUsers();
                    if (isMounted) setAdminUsers(users);
                }
                else if (adminTab === 'files') {
                    const allFiles = await getAllFilesGlobal();
                    if (isMounted) setAdminFiles(allFiles);
                }
                else if (adminTab === 'config') {
                    const conf = await getCDNConfig();
                    if (isMounted && conf) {
                        setCdnConfig({
                            ...conf,
                            rootPath: conf.rootPath || 'public/content'
                        });
                    }
                }
            } catch (dbError) {
                console.error("DB Stats failed", dbError);
            }
        }
    };
    fetchAdminData();
    return () => { isMounted = false; };
  }, [view, user, adminTab]);

  // --- Auth Actions ---

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        if (!authUsername || !authPassword || !authEmail) {
            setAuthError('Todos os campos são obrigatórios');
            return;
        }
        const newUser: User = {
          id: `u-${Date.now()}`,
          username: authUsername,
          password: authPassword,
          email: authEmail,
          role: 'user',
          plan: 'free',
          avatar: `https://ui-avatars.com/api/?name=${authUsername}&background=random`,
          storageUsed: 0,
          storageLimit: 5 * 1024 * 1024 * 1024,
          createdAt: new Date().toISOString(),
          isActive: true
        };
        await registerUser(newUser);
        setUser(newUser);
        localStorage.setItem('cloudfire_user', newUser.id);
        setView('dashboard');
      } else {
        const loggedUser = await loginUser(authUsername, authPassword);
        if (loggedUser) {
          setUser(loggedUser);
          localStorage.setItem('cloudfire_user', loggedUser.id);
          setView(loggedUser.role === 'admin' ? 'admin' : 'dashboard');
        } else {
          setAuthError('Nome de usuário ou senha inválidos (ou conta bloqueada)');
        }
      }
    } catch (err: any) {
      setAuthError(err.toString());
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cloudfire_user');
    setView('login');
    setAuthUsername('');
    setAuthPassword('');
    setCurrentFolderId('root');
  };

  // --- Admin Management Actions ---

  const handleAdminUpdateUser = async (targetUser: User, updates: Partial<User>) => {
      const updatedUser = { ...targetUser, ...updates };
      await updateUser(updatedUser);
      const users = await getAllUsers();
      setAdminUsers(users);
  };

  const handleAdminDeleteUser = async (username: string) => {
      if (window.confirm(`Tem certeza que deseja excluir o usuário ${username}? Isso apagará todos os arquivos dele.`)) {
          await deleteUser(username);
          const users = await getAllUsers();
          setAdminUsers(users);
      }
  };

  const handleAdminDeleteFile = async (file: CloudFile) => {
      if (window.confirm(`Deletar arquivo global: ${file.name}?`)) {
          await deleteFileFromDB(file.id, file.ownerId, file.size);
          const allFiles = await getAllFilesGlobal();
          setAdminFiles(allFiles);
      }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      await saveCDNConfig(cdnConfig);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  }

  // --- File Actions ---

  const navigateFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSelectedFile(null);
  };

  const goUp = () => {
    setCurrentFolderId('root');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      setIsUploading(true);
      setUploadProgress(10);
      await new Promise(r => setTimeout(r, 300));
      setUploadProgress(30);

      const rootPath = cdnConfig.rootPath || 'public/content';
      const storageKey = `${rootPath}/${file.name}`;

      const newFile: CloudFile = {
        id: `fi-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: getFileType(file.type),
        parentId: currentFolderId,
        createdAt: new Date().toISOString(),
        mimeType: file.type || 'application/octet-stream',
        ownerId: user.id,
        storageKey: storageKey,
        data: file,
        isShared: false
      };

      try {
        setUploadProgress(60);
        await addFileToDB(newFile);
        setUser(prev => prev ? { ...prev, storageUsed: prev.storageUsed + file.size } : null);
        setUploadProgress(100);
        await new Promise(r => setTimeout(r, 500));
        await loadContent(currentFolderId);
        setIsUploadModalOpen(false);
        setUploadProgress(0);
        setIsUploading(false);
      } catch (err) {
        alert("Falha no envio. Erro no banco de dados ou cota excedida.");
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!folderNameInput.trim() || !user) return;
    const newFolder: CloudFolder = {
      id: `f-${Date.now()}`,
      name: folderNameInput,
      parentId: currentFolderId,
      createdAt: new Date().toISOString(),
      ownerId: user.id
    };
    await addFolderToDB(newFolder);
    loadContent(currentFolderId);
    setFolderNameInput('');
    setIsFolderModalOpen(false);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!user) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    if (view === 'trash') {
        // PERMANENT DELETE
        if (window.confirm("Isso excluirá o arquivo permanentemente. Deseja continuar?")) {
            await deleteFileFromDB(fileId, user.id, file.size);
            // Update local user storage state immediately
            setUser(prev => prev ? { ...prev, storageUsed: Math.max(0, prev.storageUsed - file.size) } : null);
        } else {
            return;
        }
    } else {
        // MOVE TO TRASH
        await trashFile(fileId);
    }

    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) setSelectedFile(null);
  };

  const handleRestoreFile = async (fileId: string) => {
      if (!user) return;
      await restoreFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (selectedFile?.id === fileId) setSelectedFile(null);
  };

  const handleEmptyTrash = async () => {
      if (!user) return;
      if (window.confirm("Isso apagará todos os itens da lixeira permanentemente. Tem certeza?")) {
          await emptyTrash(user.id);
          // Reload to reflect changes (should be empty)
          loadContent('root');
          // Need to recalc storage used ideally, but for now we rely on deleteFileFromDB updating it
          // Force user refresh to get accurate storage?
          const updatedUsers = await getAllUsers();
          const me = updatedUsers.find(u => u.id === user.id);
          if (me) setUser(me);
      }
  };

  const handleDownload = async (file: CloudFile) => {
    try {
        const blob = await getFileContent(file.id);
        if (!blob) {
            alert("Conteúdo do arquivo não encontrado!");
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed", e);
    }
  };

  // --- Sharing Actions ---
  const handleShareToggle = async () => {
      if (!selectedFile) return;
      const newStatus = !selectedFile.isShared;
      let token = selectedFile.shareToken;
      if (newStatus && !token) {
          token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      await updateFileShareStatus(selectedFile.id, newStatus, newStatus ? token : undefined);
      setSelectedFile(prev => prev ? ({ ...prev, isShared: newStatus, shareToken: newStatus ? token : undefined }) : null);
      setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, isShared: newStatus, shareToken: newStatus ? token : undefined } : f));
  }

  const handleCopyLink = () => {
      if (!selectedFile?.shareToken) return;
      const link = `${window.location.origin}?share=${selectedFile.shareToken}`;
      navigator.clipboard.writeText(link);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
  }

  // --- Render Preview Component ---
  const renderPreview = (file: CloudFile, url: string | null, isLoading: boolean) => {
      return (
        <div className="flex flex-col items-center p-2 bg-slate-50 rounded-xl border border-slate-100 min-h-[200px] justify-center relative overflow-hidden w-full">
            {isLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="animate-spin" /> Carregando visualização...
                </div>
            ) : url ? (
                 file.type === FileType.IMAGE ? (
                     <img src={url} alt="Preview" className="w-full h-auto rounded-lg object-contain shadow-sm max-h-[300px]" />
                 ) : file.type === FileType.VIDEO ? (
                     <div className="w-full">
                         <video controls src={url} className="w-full rounded-lg bg-black shadow-sm max-h-[300px]" />
                     </div>
                 ) : file.type === FileType.AUDIO ? (
                     <div className="w-full flex flex-col items-center gap-4 py-4">
                         <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center animate-pulse">
                             <Play size={32} fill="currentColor" />
                         </div>
                         <audio controls src={url} className="w-full" />
                     </div>
                 ) : (
                      <FileIcon type={file.type} className="w-16 h-16 mb-4" />
                 )
            ) : (
                 <div className="flex flex-col items-center">
                     <FileIcon type={file.type} className="w-24 h-24 mb-4" />
                     <span className="text-xs text-slate-400">Visualização indisponível</span>
                 </div>
            )}
            
            {!url && !isLoading && (
                <div className="text-center break-all font-medium text-slate-700 mt-4 px-2">{file.name}</div>
            )}
         </div>
      );
  }

  // --- Views ---

  if (view === 'shared') {
      return (
          <div className="min-h-screen bg-slate-200 flex flex-col items-center p-4 pt-10">
              <div className="w-full max-w-4xl flex justify-center mb-8">
                  <div className="text-3xl font-bold text-blue-600 flex items-center gap-2">
                     <span className="text-4xl">☁️</span> CloudFire
                  </div>
              </div>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-slate-300">
                  <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                       <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                           <Download size={20} className="text-blue-500" />
                           Download de Arquivo
                       </h2>
                       <a href="/" className="text-blue-600 text-sm hover:underline">Fazer Login</a>
                  </div>
                  <div className="p-8">
                      {sharedError ? (
                          <div className="text-center py-10">
                              <div className="bg-red-50 text-red-500 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                  <Lock size={32} />
                              </div>
                              <h2 className="text-xl font-bold text-slate-800 mb-2">Arquivo Indisponível</h2>
                              <p className="text-slate-500">{sharedError}</p>
                          </div>
                      ) : sharedFile ? (
                          <div className="flex flex-col md:flex-row gap-8">
                              <div className="flex-1 space-y-4">
                                  <div className="bg-blue-600 text-white p-6 rounded-lg text-center shadow-lg hover:bg-blue-700 transition-colors cursor-pointer group" onClick={() => handleDownload(sharedFile)}>
                                      <div className="font-bold text-xl mb-1 truncate px-2">{sharedFile.name}</div>
                                      <div className="text-blue-200 text-sm mb-4">
                                          ({formatSize(sharedFile.size)}) • {translateFileType(sharedFile.type)}
                                      </div>
                                      <div className="bg-white text-blue-600 font-bold py-3 px-6 rounded shadow-sm inline-flex items-center gap-2 group-hover:scale-105 transition-transform">
                                          <Download size={20} /> BAIXAR AGORA
                                      </div>
                                  </div>
                                  <div className="text-center text-xs text-slate-400">
                                      Este arquivo está hospedado no CloudFire. Verificado contra vírus (Simulado).
                                  </div>
                              </div>
                              <div className="w-full md:w-64 flex flex-col items-center justify-center bg-slate-50 rounded-lg p-4 border border-slate-100">
                                   <div className="mb-4">
                                       <FileIcon type={sharedFile.type} className="w-20 h-20" />
                                   </div>
                                   <div className="text-sm font-medium text-slate-700 text-center break-all">
                                       {sharedFile.name}
                                   </div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex justify-center py-20">
                              <Loader2 className="animate-spin text-blue-500" size={40} />
                          </div>
                      )}
                  </div>
              </div>
              <Footer />
          </div>
      );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
             <div className="bg-blue-100 p-3 rounded-full">
               <span className="text-3xl font-bold text-blue-600 flex items-center gap-2">
                 <span className="text-4xl">☁️</span> CloudFire
               </span>
             </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
             {isRegistering ? 'Criar Conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-center text-slate-500 mb-6">Armazenamento em nuvem simples e seguro.</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
                <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input 
                        type="email" 
                        placeholder="Endereço de Email" 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                    />
                </div>
            )}
            <div className="relative">
                <UserIcon className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Nome de Usuário" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={authUsername}
                    onChange={e => setAuthUsername(e.target.value)}
                />
            </div>
            <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                    type="password" 
                    placeholder="Senha" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                />
            </div>
            
            {authError && <div className="text-red-500 text-sm text-center">{authError}</div>}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              {isRegistering ? 'Cadastrar' : 'Entrar'} <ChevronRight size={18} />
            </button>
          </form>

          {!isRegistering && (
             <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100 text-center">
                <strong>Admin de Demonstração:</strong> usuário: <code>admin</code> / senha: <code>password</code>
             </div>
          )}

          <div className="mt-6 text-center">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                className="text-sm text-blue-600 font-medium hover:underline"
            >
                {isRegistering ? 'Já tem uma conta? Entre' : "Não tem uma conta? Cadastre-se"}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Common Layout Header
  const Header = () => (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-blue-600 flex items-center gap-2 cursor-pointer" onClick={() => setView(user?.role === 'admin' ? 'admin' : 'dashboard')}>
          <span className="hidden sm:inline">CloudFire</span>
          <span className="sm:hidden">CF</span>
        </div>
        {view === 'dashboard' && (
          <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-2 w-64 lg:w-96 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <Search size={18} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Pesquisar arquivos..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-700"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user?.role === 'admin' && view === 'dashboard' && (
             <Button variant="ghost" onClick={() => setView('admin')}>Painel Admin</Button>
        )}
        {user?.role === 'admin' && view === 'admin' && (
             <Button variant="ghost" onClick={() => setView('dashboard')}>Meus Arquivos</Button>
        )}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div 
                className="text-right hidden sm:block cursor-pointer hover:bg-slate-50 p-1 rounded"
                onClick={() => setView('profile')}
            >
                <div className="text-sm font-semibold text-slate-700">{user?.username}</div>
                <div className="text-xs text-slate-500 uppercase flex justify-end gap-1">
                    {user?.plan === 'pro' && <span className="text-yellow-600">★</span>}
                    {user?.role}
                </div>
            </div>
          <img 
            src={user?.avatar} 
            alt="Avatar" 
            className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 cursor-pointer"
            onClick={() => setView('profile')} 
          />
          <Button variant="ghost" className="!p-2 text-slate-400 hover:text-red-500" onClick={handleLogout}>
            <LogOut size={20} />
          </Button>
        </div>
      </div>
    </header>
  );

  // --- Profile View ---
  if (view === 'profile' && user) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col">
              <Header />
              <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
                 <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setView(user.role === 'admin' ? 'admin' : 'dashboard')} className="p-2 hover:bg-slate-200 rounded-full">
                        <ArrowLeft />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">Meu Perfil</h1>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 md:col-span-1 flex flex-col items-center">
                         <img src={user.avatar} className="w-32 h-32 rounded-full mb-4 border-4 border-blue-50" alt="Avatar"/>
                         <h2 className="text-xl font-bold text-slate-800">{user.username}</h2>
                         <p className="text-slate-500">{user.email}</p>
                         <div className="mt-4 flex gap-2">
                             <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 uppercase">{user.role}</span>
                             <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${user.plan === 'pro' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                 {user.plan}
                             </span>
                         </div>
                     </div>

                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                             <HardDrive size={20} className="text-blue-600"/> Armazenamento e Plano
                         </h3>
                         <div className="mb-6">
                             <div className="flex justify-between text-sm font-semibold text-slate-600 mb-2">
                                <span>Uso Atual</span>
                                <span>{Math.round((user.storageUsed / user.storageLimit) * 100)}%</span>
                             </div>
                             <div className="w-full bg-slate-200 rounded-full h-3">
                                <div 
                                    className="bg-blue-500 h-3 rounded-full transition-all duration-500" 
                                    style={{width: `${Math.min(100, Math.round((user.storageUsed / user.storageLimit) * 100))}%`}}>
                                </div>
                             </div>
                             <div className="text-xs text-slate-400 mt-2 text-right">
                                {formatSize(user.storageUsed)} de {formatSize(user.storageLimit)}
                             </div>
                         </div>
                         {user.plan !== 'pro' && user.plan !== 'enterprise' && (
                             <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-lg">
                                 <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                     <CreditCard size={18}/> Faça Upgrade para Pro
                                 </h4>
                                 <p className="text-sm text-blue-600 mb-4">Aumente seu armazenamento para 1TB e desbloqueie uploads mais rápidos.</p>
                                 <Button onClick={() => {
                                     updateUser({...user, plan: 'pro', storageLimit: 1024 * 1024 * 1024 * 1024});
                                     setUser({...user, plan: 'pro', storageLimit: 1024 * 1024 * 1024 * 1024});
                                     alert("Upgrade realizado com sucesso! (Simulação)");
                                 }}>
                                     Atualizar Agora
                                 </Button>
                             </div>
                         )}
                     </div>
                 </div>
                 <Footer />
              </main>
          </div>
      )
  }

  // --- Admin View ---
  if (view === 'admin') {
    return (
      <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-4 font-bold text-slate-400 text-xs uppercase tracking-wider">
                    Administração
                </div>
                <nav className="flex-1 px-2 space-y-1">
                    <button onClick={() => setAdminTab('overview')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${adminTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <HardDrive size={18} /> Visão Geral
                    </button>
                    <button onClick={() => setAdminTab('users')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${adminTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <Users size={18} /> Usuários
                    </button>
                    <button onClick={() => setAdminTab('files')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${adminTab === 'files' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <Folder size={18} /> Arquivos (Global)
                    </button>
                    <button onClick={() => setAdminTab('config')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${adminTab === 'config' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <Settings size={18} /> Configurações
                    </button>
                </nav>
            </aside>
            <main className="flex-1 p-6 overflow-y-auto pb-24">
                {adminTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-slate-800">Painel de Controle</h1>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium animate-pulse">Sistema Online</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">Total de Usuários</div>
                                <div className="text-3xl font-bold text-slate-800">{systemStats?.totalUsers || 0}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">Armazenamento Global</div>
                                <div className="text-3xl font-bold text-slate-800">{formatSize(systemStats?.totalStorage || 0)}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">Arquivos Totais</div>
                                <div className="text-3xl font-bold text-slate-800">{systemStats?.totalFiles || 0}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Atividade Recente</h3>
                            {systemStats && <AdminChart data={systemStats.recentUploads} />}
                            </div>
                        </div>
                    </div>
                )}
                {/* Simplified Admin sections for brevity, using same logic as previous step */}
                {adminTab === 'config' && (
                     <div className="space-y-6 max-w-2xl pb-10">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold text-slate-800">Integração de Armazenamento</h1>
                            {configSaved && <span className="text-green-600 text-sm font-bold animate-pulse">Configurações salvas!</span>}
                        </div>
                        <form onSubmit={handleSaveConfig} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Caminho Base (Físico/Bucket)</label>
                                <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.rootPath || ''} onChange={e => setCdnConfig({...cdnConfig, rootPath: e.target.value})} placeholder="public/content" />
                                <p className="text-xs text-slate-400 mt-1">Todos os arquivos serão salvos dentro desta estrutura de pastas no provedor selecionado.</p>
                            </div>
                            
                            {/* Local Storage Card */}
                            <div className={`border rounded-xl p-4 flex items-center justify-between transition-all ${cdnConfig.provider === 'local' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${cdnConfig.provider === 'local' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}><Server size={24} /></div>
                                    <div><h3 className="font-bold text-slate-800">Armazenamento Local</h3><p className="text-xs text-slate-500">Usa o banco de dados do navegador/servidor local.</p></div>
                                </div>
                                <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer" onClick={() => setCdnConfig({...cdnConfig, provider: 'local'})} style={{backgroundColor: cdnConfig.provider === 'local' ? '#2563EB' : '#E2E8F0'}}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cdnConfig.provider === 'local' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                            </div>

                             {/* AWS S3 Card */}
                             <div className={`border rounded-xl transition-all overflow-hidden ${cdnConfig.provider === 'aws' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${cdnConfig.provider === 'aws' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Cloud size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">Amazon S3</h3>
                                            <p className="text-xs text-slate-500">Bucket S3 padrão da AWS.</p>
                                        </div>
                                    </div>
                                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer" 
                                         onClick={() => setCdnConfig({...cdnConfig, provider: 'aws'})} 
                                         style={{backgroundColor: cdnConfig.provider === 'aws' ? '#2563EB' : '#E2E8F0'}}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cdnConfig.provider === 'aws' ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                                {cdnConfig.provider === 'aws' && (
                                    <div className="p-4 border-t border-blue-200 bg-white/50 space-y-3 animate-in fade-in slide-in-from-top-1">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Endpoint URL (Opcional)</label>
                                            <input type="text" placeholder="https://s3.amazonaws.com" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.endpoint || ''} onChange={e => setCdnConfig({...cdnConfig, endpoint: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Bucket Name</label>
                                                <input type="text" placeholder="my-bucket" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.bucket || ''} onChange={e => setCdnConfig({...cdnConfig, bucket: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Region</label>
                                                <input type="text" placeholder="us-east-1" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.region || ''} onChange={e => setCdnConfig({...cdnConfig, region: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Access Key</label>
                                                <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.accessKey || ''} onChange={e => setCdnConfig({...cdnConfig, accessKey: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Secret Key</label>
                                                <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.secretKey || ''} onChange={e => setCdnConfig({...cdnConfig, secretKey: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Wasabi Card */}
                            <div className={`border rounded-xl transition-all overflow-hidden ${cdnConfig.provider === 'wasabi' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${cdnConfig.provider === 'wasabi' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Database size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">Wasabi Hot Cloud</h3>
                                            <p className="text-xs text-slate-500">Armazenamento compatível com S3 de baixo custo.</p>
                                        </div>
                                    </div>
                                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer" 
                                         onClick={() => setCdnConfig({...cdnConfig, provider: 'wasabi'})} 
                                         style={{backgroundColor: cdnConfig.provider === 'wasabi' ? '#2563EB' : '#E2E8F0'}}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cdnConfig.provider === 'wasabi' ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                                {cdnConfig.provider === 'wasabi' && (
                                    <div className="p-4 border-t border-blue-200 bg-white/50 space-y-3 animate-in fade-in slide-in-from-top-1">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Endpoint URL</label>
                                            <input type="text" placeholder="https://s3.wasabisys.com" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.endpoint || ''} onChange={e => setCdnConfig({...cdnConfig, endpoint: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Bucket Name</label>
                                                <input type="text" placeholder="my-bucket" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.bucket || ''} onChange={e => setCdnConfig({...cdnConfig, bucket: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Region</label>
                                                <input type="text" placeholder="us-east-1" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.region || ''} onChange={e => setCdnConfig({...cdnConfig, region: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Access Key</label>
                                                <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.accessKey || ''} onChange={e => setCdnConfig({...cdnConfig, accessKey: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Secret Key</label>
                                                <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.secretKey || ''} onChange={e => setCdnConfig({...cdnConfig, secretKey: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Google Drive Card */}
                            <div className={`border rounded-xl transition-all overflow-hidden ${cdnConfig.provider === 'google_drive' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${cdnConfig.provider === 'google_drive' ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <HardDrive size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">Google Drive</h3>
                                            <p className="text-xs text-slate-500">Integração via API OAuth 2.0.</p>
                                        </div>
                                    </div>
                                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer" 
                                         onClick={() => setCdnConfig({...cdnConfig, provider: 'google_drive'})} 
                                         style={{backgroundColor: cdnConfig.provider === 'google_drive' ? '#2563EB' : '#E2E8F0'}}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cdnConfig.provider === 'google_drive' ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                                {cdnConfig.provider === 'google_drive' && (
                                    <div className="p-4 border-t border-blue-200 bg-white/50 space-y-3 animate-in fade-in slide-in-from-top-1">
                                         <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Client ID</label>
                                            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.clientId || ''} onChange={e => setCdnConfig({...cdnConfig, clientId: e.target.value})} />
                                         </div>
                                         <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Client Secret</label>
                                            <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.clientSecret || ''} onChange={e => setCdnConfig({...cdnConfig, clientSecret: e.target.value})} />
                                         </div>
                                         <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Refresh Token</label>
                                            <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none focus:border-blue-500" value={cdnConfig.refreshToken || ''} onChange={e => setCdnConfig({...cdnConfig, refreshToken: e.target.value})} />
                                         </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex justify-end sticky bottom-0 bg-slate-50 py-4 border-t border-slate-200 mt-4">
                                <Button type="submit" variant="success" className="shadow-lg"><Save size={18} /> Salvar Alterações</Button>
                            </div>
                        </form>
                     </div>
                )}
                <Footer />
            </main>
        </div>
      </div>
    );
  }

  // Main Dashboard View
  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
          <div className="p-4 space-y-2">
            <button 
              onClick={() => {
                setUploadProgress(0);
                setIsUploading(false);
                setIsUploadModalOpen(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <Upload size={18} /> Enviar Arquivo
            </button>
            <button 
              onClick={() => setIsFolderModalOpen(true)}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={18} /> Nova Pasta
            </button>
          </div>
          
          <nav className="flex-1 px-2 py-4 space-y-1">
            <button 
                onClick={() => { setView('dashboard'); setCurrentFolderId('root'); }} 
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Folder size={18} /> Meus Arquivos
            </button>
            <button
                onClick={() => { setView('trash'); }} 
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${view === 'trash' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
                <Trash2 size={18} /> Lixeira
            </button>
          </nav>

          <div className="p-4 m-4 bg-slate-50 rounded-xl border border-slate-100">
             <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
               <span>Armazenamento</span>
               <span>{user?.storageLimit ? Math.round((user.storageUsed / user.storageLimit) * 100) : 0}%</span>
             </div>
             <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
               <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                style={{width: `${user?.storageLimit ? Math.min(100, Math.round((user.storageUsed / user.storageLimit) * 100)) : 0}%`}}>
               </div>
             </div>
             <div className="text-xs text-slate-400">
               {formatSize(user?.storageUsed || 0)} usado de {formatSize(user?.storageLimit || 0)}
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Breadcrumbs & Actions */}
          <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {view === 'dashboard' && currentFolderId !== 'root' && (
                <button onClick={goUp} className="p-1 hover:bg-slate-100 rounded-full mr-2">
                  <ArrowLeft size={18} className="text-slate-500" />
                </button>
              )}
               <div className="text-sm font-medium text-slate-800">
                  {view === 'trash' ? 'Lixeira (Itens Excluídos)' : (currentFolderId === 'root' ? 'Meus Arquivos' : folders.find(f => f.id === currentFolderId)?.name || 'Pasta')}
               </div>
            </div>
            
            {view === 'trash' && files.length > 0 && (
                <Button variant="danger" className="text-xs h-8" onClick={handleEmptyTrash}>
                    Esvaziar Lixeira
                </Button>
            )}

            <div className="flex items-center gap-2 md:hidden">
                <Button variant="ghost" onClick={() => setIsUploadModalOpen(true)}><Upload size={18}/></Button>
                <Button variant="ghost" onClick={() => setIsFolderModalOpen(true)}><Plus size={18}/></Button>
            </div>
          </div>

          {/* File Grid */}
          <div className="flex-1 overflow-y-auto p-6 pb-24">
            
            {isLoadingFiles ? (
                <div className="flex justify-center items-center h-full text-slate-400 gap-2">
                    <Loader2 className="animate-spin" /> Carregando seus arquivos...
                </div>
            ) : (
                <>
                {/* Trash Warning */}
                {view === 'trash' && files.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg mb-6 flex items-center gap-3 text-sm">
                        <AlertCircle size={20} />
                        Arquivos na lixeira são excluídos permanentemente após 30 dias (Simulação).
                    </div>
                )}

                {/* Folders Section (Only show if dashboard) */}
                {view === 'dashboard' && folders.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Pastas</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {folders.map(folder => (
                        <div 
                        key={folder.id}
                        onClick={() => navigateFolder(folder.id)}
                        className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all select-none"
                        >
                        <div className="flex justify-between items-start mb-2">
                            <Folder className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                        </div>
                        <div className="text-sm font-medium text-slate-700 truncate">{folder.name}</div>
                        </div>
                    ))}
                    </div>
                </div>
                )}

                {/* Files Section */}
                <div>
                {view === 'dashboard' && <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Arquivos</h3>}
                
                {files.length === 0 && folders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        {view === 'trash' ? <Trash2 size={40} className="text-slate-300" /> : <Folder size={40} className="text-slate-300" />}
                    </div>
                    <p>{view === 'trash' ? 'Sua lixeira está vazia' : 'Esta pasta está vazia'}</p>
                    {view === 'dashboard' && <Button variant="secondary" className="mt-4" onClick={() => setIsUploadModalOpen(true)}>Enviar Arquivos</Button>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {files.map(file => (
                        <div 
                        key={file.id}
                        onClick={() => {
                            setSelectedFile(file);
                        }}
                        className={`group bg-white rounded-xl border hover:shadow-lg cursor-pointer transition-all overflow-hidden flex flex-col ${view === 'trash' ? 'border-red-100 hover:border-red-300' : 'border-slate-200 hover:border-blue-400'}`}
                        >
                        <div className={`h-32 flex items-center justify-center relative border-b overflow-hidden ${view === 'trash' ? 'bg-red-50 border-red-50' : 'bg-slate-50 border-slate-100'}`}>
                            <FileIcon type={file.type} className="w-12 h-12" />
                            {file.isShared && (
                                <div className="absolute top-2 left-2 bg-green-500 text-white p-1 rounded-full shadow-sm z-10" title="Compartilhado">
                                    <Globe size={10} />
                                </div>
                            )}
                            {view === 'trash' && (
                                 <div className="absolute top-2 left-2 bg-red-500 text-white p-1 rounded-full shadow-sm z-10" title="Na Lixeira">
                                    <Trash2 size={10} />
                                </div>
                            )}
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                            {view === 'dashboard' ? (
                                <>
                                <button 
                                    className="p-1 bg-white/90 rounded hover:bg-white shadow text-slate-600" 
                                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                >
                                    <Download size={14} />
                                </button>
                                <button 
                                    className="p-1 bg-white/90 rounded hover:bg-white shadow text-red-500" 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                                >
                                    <Trash2 size={14} />
                                </button>
                                </>
                            ) : (
                                <>
                                <button 
                                    className="p-1 bg-white/90 rounded hover:bg-white shadow text-green-600" 
                                    onClick={(e) => { e.stopPropagation(); handleRestoreFile(file.id); }}
                                    title="Restaurar"
                                >
                                    <RefreshCw size={14} />
                                </button>
                                <button 
                                    className="p-1 bg-white/90 rounded hover:bg-white shadow text-red-600" 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                                    title="Excluir Permanentemente"
                                >
                                    <X size={14} />
                                </button>
                                </>
                            )}
                            </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                            <div>
                            <div className="text-sm font-medium text-slate-700 truncate mb-1" title={file.name}>{file.name}</div>
                            <div className="text-xs text-slate-400">{formatSize(file.size)}</div>
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>
                </>
            )}
            <Footer />
          </div>
          
          {/* File Details Sidebar (Overlay/Slide-in) */}
          {selectedFile && (
            <div className="absolute top-0 right-0 h-full w-full md:w-80 bg-white border-l border-slate-200 shadow-2xl z-20 overflow-y-auto animate-slideIn">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-bold text-slate-700">Detalhes do Arquivo</h3>
                <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              
              <div className="p-4 space-y-6">
                
                {renderPreview(selectedFile, previewUrl, isLoadingPreview)}

                {previewUrl && (
                    <div className="text-center break-all font-medium text-slate-700 text-sm border-b border-slate-100 pb-4">
                        {selectedFile.name}
                    </div>
                )}
                
                {view === 'trash' && (
                     <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-xs text-red-800 font-medium text-center">
                         Este arquivo está na lixeira. Restaure-o para visualizar ou compartilhar.
                     </div>
                )}

                {/* Storage Path Indicator */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs font-mono text-slate-500 break-all">
                    <div className="flex items-center gap-1 mb-1 font-semibold text-slate-700">
                        <HardDrive size={12} /> Caminho de Armazenamento
                    </div>
                    {selectedFile.storageKey || 'Caminho não definido'}
                </div>

                {/* Share Button Block - Only if not trashed */}
                {view !== 'trash' && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                     <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                             <Share2 size={16} /> Compartilhamento
                         </div>
                         <div className={`text-xs px-2 py-0.5 rounded-full ${selectedFile.isShared ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                             {selectedFile.isShared ? 'Ativo' : 'Inativo'}
                         </div>
                     </div>
                     <Button 
                        variant={selectedFile.isShared ? 'secondary' : 'primary'} 
                        className="w-full text-sm h-8"
                        onClick={() => setIsShareModalOpen(true)}
                     >
                         {selectedFile.isShared ? 'Gerenciar Link' : 'Compartilhar Arquivo'}
                     </Button>
                </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tipo</span>
                    <span className="font-medium text-slate-700">{translateFileType(selectedFile.type)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tamanho</span>
                    <span className="font-medium text-slate-700">{formatSize(selectedFile.size)}</span>
                  </div>
                   <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Criado em</span>
                    <span className="font-medium text-slate-700">{new Date(selectedFile.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-6 border-t border-slate-200">
                   {view === 'trash' ? (
                       <>
                        <Button variant="secondary" className="flex-1 text-sm" onClick={() => handleRestoreFile(selectedFile.id)}><RefreshCw size={16}/> Restaurar</Button>
                        <Button variant="danger" className="flex-1 text-sm" onClick={() => handleDeleteFile(selectedFile.id)}><X size={16}/> Excluir</Button>
                       </>
                   ) : (
                       <>
                        <Button className="flex-1 text-sm" onClick={() => handleDownload(selectedFile)}><Download size={16}/> Baixar</Button>
                        <Button variant="danger" className="flex-1 text-sm" onClick={() => handleDeleteFile(selectedFile.id)}><Trash2 size={16}/> Excluir</Button>
                       </>
                   )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && selectedFile && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Share2 className="text-blue-500" /> Compartilhar Arquivo
                  </h3>
                  <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={20} />
                  </button>
               </div>
               
               <div className="space-y-6">
                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                       <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${selectedFile.isShared ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                               {selectedFile.isShared ? <Globe size={20} /> : <Lock size={20} />}
                           </div>
                           <div>
                               <div className="font-semibold text-slate-700">Link Público</div>
                               <div className="text-xs text-slate-500">
                                   {selectedFile.isShared ? 'Qualquer pessoa com o link pode baixar' : 'O compartilhamento está desativado'}
                               </div>
                           </div>
                       </div>
                       <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                           <input 
                              type="checkbox" 
                              name="toggle" 
                              id="toggle" 
                              checked={selectedFile.isShared || false}
                              onChange={handleShareToggle}
                              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 transform translate-x-0 checked:translate-x-6 checked:border-green-500"
                           />
                           <label 
                              htmlFor="toggle" 
                              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${selectedFile.isShared ? 'bg-green-500' : 'bg-slate-300'}`}
                           ></label>
                       </div>
                   </div>

                   {selectedFile.isShared && (
                       <div className="animate-in fade-in slide-in-from-top-2">
                           <label className="text-sm font-medium text-slate-700 mb-2 block">Link de compartilhamento</label>
                           <div className="flex gap-2">
                               <input 
                                  readOnly
                                  type="text" 
                                  value={`${window.location.origin}?share=${selectedFile.shareToken}`}
                                  className="w-full bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none"
                               />
                               <Button variant="secondary" onClick={handleCopyLink} className="shrink-0">
                                   {shareLinkCopied ? <CheckCircle size={18} className="text-green-500"/> : <Copy size={18} />}
                               </Button>
                           </div>
                           <p className="text-xs text-slate-400 mt-2">
                               Este link expira apenas se você desativar o compartilhamento.
                           </p>
                       </div>
                   )}
               </div>

               <div className="mt-8 flex justify-end">
                   <Button onClick={() => setIsShareModalOpen(false)}>Concluído</Button>
               </div>
            </div>
          </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Enviar Arquivo</h3>
                {!isUploading && (
                    <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                )}
            </div>
            
            {/* Body */}
            {isUploading ? (
                 <div className="py-10 flex flex-col items-center">
                    <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                        {uploadProgress === 100 ? (
                             <CheckCircle className="w-full h-full text-green-500 animate-in zoom-in" />
                        ) : (
                             <Loader2 className="w-full h-full text-blue-500 animate-spin" />
                        )}
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-2">
                         <div 
                           className="bg-blue-500 h-full transition-all duration-300 ease-out"
                           style={{ width: `${uploadProgress}%` }}
                         />
                    </div>
                    <p className="text-slate-600 font-medium">
                        {uploadProgress === 100 ? 'Envio Concluído!' : 'Enviando arquivo...'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{uploadProgress}%</p>
                 </div>
            ) : (
                <div 
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
                        <Upload size={24} />
                    </div>
                    <p className="font-medium text-slate-700">Clique para enviar ou arraste e solte</p>
                    <p className="text-sm text-slate-400 mt-1">Imagens, Docs, Vídeo, Músicas</p>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
            )}
            
            {/* Footer */}
            {!isUploading && (
                <div className="flex justify-end mt-6 gap-3">
                <Button variant="secondary" onClick={() => setIsUploadModalOpen(false)}>Cancelar</Button>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Nova Pasta</h3>
            <input 
              autoFocus
              type="text" 
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="Nome da Pasta"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all mb-6"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsFolderModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateFolder}>Criar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}