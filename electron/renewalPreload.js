const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('renewal', {
  getStatus: () => ipcRenderer.invoke('renewal:getStatus'),
  renew: (key) => ipcRenderer.invoke('renewal:renew', String(key || '')),
  pickFile: () => ipcRenderer.invoke('renewal:pickFile'),
});
