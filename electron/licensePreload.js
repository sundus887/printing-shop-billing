const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('license', {
  submit: (key) => ipcRenderer.invoke('localLicense:submit', String(key || '')),
  cancel: () => ipcRenderer.invoke('localLicense:cancel'),
});
