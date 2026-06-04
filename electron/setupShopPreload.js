const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupApi', {
  save: (payload) => ipcRenderer.invoke('shopProfile:save', payload),
});
