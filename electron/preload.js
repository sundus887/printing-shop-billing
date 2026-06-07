const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dashboard
  getDashboardSummary: () => ipcRenderer.invoke('dashboard:summary'),

  // Customers
  getCustomers: () => ipcRenderer.invoke('customers:getAll'),
  addCustomer: (c) => ipcRenderer.invoke('customers:add', c),
  updateCustomer: (c) => ipcRenderer.invoke('customers:update', c),
  removeCustomer: (id) => ipcRenderer.invoke('customers:remove', id),

  // Invoices
  createInvoice: (invoice) => ipcRenderer.invoke('invoices:create', invoice),
  getInvoices: () => ipcRenderer.invoke('invoices:getAll'),
  getInvoice: (id) => ipcRenderer.invoke('invoices:get', id),
  updateInvoice: (id, payload) => ipcRenderer.invoke('invoices:update', id, payload),

  // Expenses
  addExpense: (exp) => ipcRenderer.invoke('expenses:add', exp),
  getExpenses: (filter) => ipcRenderer.invoke('expenses:getAll', filter || {}),

  // Payments
  addPayment: (p) => ipcRenderer.invoke('payments:add', p),

  // Ledger
  getLedger: (customerId, from, to) => ipcRenderer.invoke('ledger:get', customerId, from, to),

  // Quick Items
  getQuickItems: () => ipcRenderer.invoke('quick:getAll'),
  addQuickItem: (item) => ipcRenderer.invoke('quick:add', item),
  updateQuickItem: (item) => ipcRenderer.invoke('quick:update', item),
  removeQuickItem: (id) => ipcRenderer.invoke('quick:remove', id),

  // Products (with cost price for P&L)
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  addProduct: (product) => ipcRenderer.invoke('products:add', product),
  updateProduct: (product) => ipcRenderer.invoke('products:update', product),
  removeProduct: (id) => ipcRenderer.invoke('products:remove', id),

  // PDF Save
  savePDF: (html, filename) => ipcRenderer.invoke('pdf:save', { html, filename }),

  // Data Export/Import (for PC migration)
  exportShopData: () => ipcRenderer.invoke('shop:export'),
  importShopData: (data) => ipcRenderer.invoke('shop:import', data),

  // Store maintenance
  clearStore: () => ipcRenderer.invoke('store:clear'),

  // Credit Book
  addCredit: (entry) => ipcRenderer.invoke('credit:add', entry),
  creditPersons: () => ipcRenderer.invoke('credit:persons'),
  creditLedger: (person, from, to) => ipcRenderer.invoke('credit:ledger', person, from, to),

  // License
  licenseGet: () => ipcRenderer.invoke('license:get'),
  licenseSet: (key) => ipcRenderer.invoke('license:set', key),
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseImportSigned: (jsonOrString) => ipcRenderer.invoke('license:importSigned', jsonOrString),
  licenseStatus: () => ipcRenderer.invoke('license:status'),

  onBackupSuccess: (handler) => {
    const cb = (event, payload) => { try { handler(payload); } catch {} };
    ipcRenderer.on('backup:success', cb);
    return () => { try { ipcRenderer.removeListener('backup:success', cb); } catch {} };
  },

  brandingGet: () => ipcRenderer.invoke('branding:get'),
  brandingSaveLogo: (dataUrl) => ipcRenderer.invoke('branding:saveLogo', dataUrl),
  brandingSaveTemplate: (payload) => ipcRenderer.invoke('branding:saveTemplate', payload),
  brandingSaveConfig: (cfg) => ipcRenderer.invoke('branding:saveConfig', cfg),
  brandingGetLogo: () => ipcRenderer.invoke('branding:getLogo'),
  brandingGetLogoBase64: () => ipcRenderer.invoke('branding:getLogoBase64'),
  brandingBuildPreview: (sample) => ipcRenderer.invoke('branding:buildPreview', sample),

  shopProfileGet: () => ipcRenderer.invoke('shopProfile:get'),

  // Machine ID
  getMachineId: () => ipcRenderer.invoke('system:getMachineId'),
}
);


