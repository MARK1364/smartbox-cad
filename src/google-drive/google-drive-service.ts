/**
 * google-drive-service.ts
 *
 * Bezpośrednia integracja z Google Drive API v3 (OAuth 2.0 / Google Identity Services).
 * Umożliwia synchronizację projektów SmartPanel CAD w chmurze Google Drive
 * dla pracy na wielu stanowiskach (biuro, warsztat, laptop).
 */

export interface GoogleDriveFile {
    id: string;
    name: string;
    modifiedTime: string;
    size?: string;
}

export interface GoogleDriveUser {
    email: string;
    name?: string;
    picture?: string;
}

const STORAGE_KEY_CLIENT_ID = 'SMARTPANEL_GDRIVE_CLIENT_ID';
const STORAGE_KEY_ACCESS_TOKEN = 'SMARTPANEL_GDRIVE_ACCESS_TOKEN';
const STORAGE_KEY_TOKEN_EXPIRY = 'SMARTPANEL_GDRIVE_TOKEN_EXPIRY';
const APP_FOLDER_NAME = 'SmartPanel CAD Projects';

declare const google: any;

export class GoogleDriveService {
    private static _instance: GoogleDriveService | null = null;
    private _accessToken: string | null = null;
    private _tokenClient: any = null;
    private _appFolderId: string | null = null;
    private _user: GoogleDriveUser | null = null;
    private _listeners: Set<() => void> = new Set();

    private constructor() {
        this._loadStoredAuth();
    }

    public static get instance(): GoogleDriveService {
        if (!GoogleDriveService._instance) {
            GoogleDriveService._instance = new GoogleDriveService();
        }
        return GoogleDriveService._instance;
    }

    public subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        for (const l of this._listeners) {
            try { l(); } catch (err) { console.error(err); }
        }
    }

    public getClientId(): string {
        return (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_CLIENT_ID)) || '';
    }

    public setClientId(clientId: string): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
        }
        this._tokenClient = null; // Zresetuj token client, aby użyć nowego ID
        this._notify();
    }

    public isAuthenticated(): boolean {
        return !!this._accessToken;
    }

    public getUser(): GoogleDriveUser | null {
        return this._user;
    }

    private _loadStoredAuth(): void {
        if (typeof localStorage === 'undefined') return;
        const token = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
        const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
        if (token && expiry && Number(expiry) > Date.now()) {
            this._accessToken = token;
            this._fetchUserInfo().catch(() => {});
        } else {
            this._clearStoredToken();
        }
    }

    private _clearStoredToken(): void {
        this._accessToken = null;
        this._user = null;
        this._appFolderId = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
            localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
        }
    }

    /**
     * Dynamiczne załadowanie biblioteki Google Identity Services GIS
     */
    public async loadGsiScript(): Promise<boolean> {
        if (typeof (window as any).google?.accounts?.oauth2 !== 'undefined') {
            return true;
        }

        return new Promise((resolve) => {
            const existingScript = document.getElementById('gsi-client-script');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(true));
                return;
            }

            const script = document.createElement('script');
            script.id = 'gsi-client-script';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(true);
            script.onerror = () => {
                console.error('[GoogleDrive] Nie udało się załadować skryptu Google Identity Services.');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Logowanie i autoryzacja konta Google (OAuth 2.0 Token Flow)
     */
    public async signIn(customClientId?: string): Promise<boolean> {
        const clientId = (customClientId || this.getClientId()).trim();
        if (!clientId) {
            throw new Error('Wymagany jest identyfikator Google Client ID.');
        }

        await this.loadGsiScript();

        return new Promise((resolve, reject) => {
            try {
                this._tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse.error) {
                            console.error('[GoogleDrive] Błąd logowania:', tokenResponse.error);
                            reject(new Error(tokenResponse.error_description || tokenResponse.error));
                            return;
                        }

                        this._accessToken = tokenResponse.access_token;
                        const expiresInMs = (tokenResponse.expires_in || 3599) * 1000;
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, this._accessToken as string);
                            localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, String(Date.now() + expiresInMs));
                        }

                        await this._fetchUserInfo();
                        await this._ensureAppFolder();
                        this._notify();
                        resolve(true);
                    },
                });

                this._tokenClient.requestAccessToken({ prompt: '' });
            } catch (err) {
                reject(err);
            }
        });
    }

    public signOut(): void {
        if (this._accessToken && typeof google !== 'undefined' && google.accounts?.oauth2) {
            google.accounts.oauth2.revoke(this._accessToken, () => {});
        }
        this._clearStoredToken();
        this._notify();
    }

    private async _fetchUserInfo(): Promise<void> {
        if (!this._accessToken) return;
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this._accessToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                this._user = {
                    email: data.email,
                    name: data.name || data.email,
                    picture: data.picture
                };
            }
        } catch (err) {
            console.warn('[GoogleDrive] Nie udało się pobrać danych profilu:', err);
        }
    }

    /**
     * Tworzy lub odnajduje dedykowany folder 'SmartPanel CAD Projects'
     */
    private async _ensureAppFolder(): Promise<string> {
        if (this._appFolderId) return this._appFolderId;
        if (!this._accessToken) throw new Error('Brak autoryzacji Google Drive.');

        // 1. Szukaj istniejącego folderu
        const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`);
        const searchResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
            headers: { Authorization: `Bearer ${this._accessToken}` }
        });

        if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.files && searchData.files.length > 0) {
                this._appFolderId = searchData.files[0].id;
                return this._appFolderId as string;
            }
        }

        // 2. Jeśli nie istnieje, utwórz nowy folder
        const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this._accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: APP_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        if (!createResp.ok) {
            throw new Error(`Błąd tworzenia folderu na Dysku Google (${createResp.statusText})`);
        }

        const createData = await createResp.json();
        this._appFolderId = createData.id;
        return this._appFolderId as string;
    }

    /**
     * Pobiera listę projektów z folderu SmartPanel CAD Projects
     */
    public async listProjects(): Promise<GoogleDriveFile[]> {
        if (!this._accessToken) throw new Error('Brak zalogowanego konta Google.');
        const folderId = await this._ensureAppFolder();

        const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`, {
            headers: { Authorization: `Bearer ${this._accessToken}` }
        });

        if (!resp.ok) {
            if (resp.status === 401) {
                this._clearStoredToken();
                this._notify();
                throw new Error('Sesja Google wygasła. Zaloguj się ponownie.');
            }
            throw new Error(`Błąd pobierania listy plików (${resp.statusText})`);
        }

        const data = await resp.json();
        return data.files || [];
    }

    /**
     * Zapisuje lub aktualizuje projekt w chmurze Google Drive (Multipart Upload)
     */
    public async saveProject(fileName: string, projectData: any, existingFileId?: string): Promise<GoogleDriveFile> {
        if (!this._accessToken) throw new Error('Brak zalogowanego konta Google.');
        const folderId = await this._ensureAppFolder();

        let cleanName = fileName.trim();
        if (!cleanName.endsWith('.spp.json') && !cleanName.endsWith('.json')) {
            cleanName = `${cleanName}.spp.json`;
        }

        const metadata: any = {
            name: cleanName,
            mimeType: 'application/json'
        };

        if (!existingFileId) {
            metadata.parents = [folderId];
        }

        const fileContent = typeof projectData === 'string' ? projectData : JSON.stringify(projectData, null, 2);
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            fileContent +
            closeDelimiter;

        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

        const method = existingFileId ? 'PATCH' : 'POST';

        const resp = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this._accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartRequestBody
        });

        if (!resp.ok) {
            if (resp.status === 401) {
                this._clearStoredToken();
                this._notify();
                throw new Error('Sesja Google wygasła. Zaloguj się ponownie.');
            }
            throw new Error(`Błąd zapisu pliku na Dysku Google (${resp.statusText})`);
        }

        return await resp.json();
    }

    /**
     * Wczytuje treść projektu z Dysku Google
     */
    public async loadProject(fileId: string): Promise<any> {
        if (!this._accessToken) throw new Error('Brak zalogowanego konta Google.');

        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${this._accessToken}` }
        });

        if (!resp.ok) {
            if (resp.status === 401) {
                this._clearStoredToken();
                this._notify();
                throw new Error('Sesja Google wygasła. Zaloguj się ponownie.');
            }
            throw new Error(`Błąd pobierania pliku (${resp.statusText})`);
        }

        return await resp.json();
    }

    /**
     * Usuwa plik z Dysku Google
     */
    public async deleteProject(fileId: string): Promise<boolean> {
        if (!this._accessToken) throw new Error('Brak zalogowanego konta Google.');

        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this._accessToken}` }
        });

        return resp.ok;
    }
}
