const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let main;
let login;

function createWindow() {
    main = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'images/icon.png')
    });

    main.loadFile('index.html');
    main.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('login-discord', async () => {
    return new Promise((resolve, reject) => {
        if (login) {
            login.focus();
            return;
        }

        login = new BrowserWindow({
            width: 500,
            height: 800,
            parent: main,
            modal: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const filter = {
            urls: ['https://discord.com/api/*']
        };

        session.defaultSession.webRequest.onBeforeSendHeaders(filter, async (details, callback) => {
            const authHeader = details.requestHeaders['Authorization'];
            if (authHeader && authHeader !== 'undefined' && authHeader !== 'null') {
                try {
                    const response = await fetch('https://discord.com/api/users/@me', {
                        headers: {
                            'Authorization': authHeader
                        }
                    });
                    const u = await response.json();
                    console.log(`Token found, username: ${u.username}`);
                } catch (error) {
                    console.error('Failed to fetch username:', error);
                    reject(error);
                }

                if (login && !login.isDestroyed()) {
                    login.close();
                }
                login = null;

                resolve(authHeader);
            }
            callback({ requestHeaders: details.requestHeaders });
        });

        login.loadURL('https://discord.com/login');

        login.on('closed', () => {
            login = null;
            resolve(null);
        });
    });
});

ipcMain.handle('logout-discord', async () => {
    try {
        await session.defaultSession.clearStorageData();
        console.log('Session data cleared.');
    } catch (error) {
        console.error('Failed to clear session data:', error);
    }
});
