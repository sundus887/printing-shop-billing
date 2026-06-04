import React, { useState } from 'react';

export default function DataMigration() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [message, setMessage] = useState('');

  // Export data
  const handleExport = async () => {
    setExporting(true);
    setMessage('');
    try {
      const result = await window.api.exportShopData();
      if (result.success) {
        const jsonData = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `shop-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setMessage(`✅ Data exported successfully!\n\n` +
          `Customers: ${result.data.counts.customers}\n` +
          `Invoices: ${result.data.counts.invoices}\n` +
          `Products: ${result.data.counts.products}\n` +
          `Expenses: ${result.data.counts.expenses}\n` +
          `Payments: ${result.data.counts.payments}\n` +
          `Quick Items: ${result.data.counts.quick_items}\n` +
          `Credit Entries: ${result.data.counts.credit_entries}`);
      } else {
        setMessage('❌ Export failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Export error:', err);
      setMessage('❌ Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        setImportData(jsonData);
        setPreviewData(jsonData.counts || {});
        setMessage('');
      } catch (err) {
        setMessage('❌ Invalid file format. Please select a valid backup file.');
        setImportData(null);
        setPreviewData(null);
      }
    };
    reader.readAsText(file);
  };

  // Import data
  const handleImport = async () => {
    if (!importData) {
      alert('Please select a backup file first');
      return;
    }

    const confirmed = confirm(
      '⚠️ WARNING: This will REPLACE all current data!\n\n' +
      'Current data will be backed up automatically.\n\n' +
      'Import Data:\n' +
      `• Customers: ${previewData.customers || 0}\n` +
      `• Invoices: ${previewData.invoices || 0}\n` +
      `• Products: ${previewData.products || 0}\n` +
      `• Expenses: ${previewData.expenses || 0}\n` +
      `• Payments: ${previewData.payments || 0}\n\n` +
      'Are you sure you want to continue?'
    );

    if (!confirmed) return;

    setImporting(true);
    setMessage('');
    try {
      const result = await window.api.importShopData(importData);
      if (result.success) {
        setMessage(`✅ Data imported successfully!\n\n` +
          `Customers: ${result.counts.customers}\n` +
          `Invoices: ${result.counts.invoices}\n` +
          `Products: ${result.counts.products}\n` +
          `Expenses: ${result.counts.expenses}\n` +
          `Payments: ${result.counts.payments}\n` +
          `Quick Items: ${result.counts.quick_items}\n` +
          `Credit Entries: ${result.counts.credit_entries}\n\n` +
          'Please restart the app to see the imported data.');
        setImportData(null);
        setPreviewData(null);
      } else {
        setMessage('❌ Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Import error:', err);
      setMessage('❌ Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <div className="text-2xl font-semibold section-accent">Data Migration</div>
        <div className="opacity-70 text-sm">Export and import shop data for PC migration</div>
      </div>

      {/* Info Card */}
      <div className="card" style={{ backgroundColor: 'rgba(31,58,138,0.04)' }}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="text-sm opacity-80">
            <strong>How to migrate data to a new PC:</strong>
            <ol className="mt-2 space-y-1 ml-4 list-decimal">
              <li><strong>Export:</strong> Click "Export Data" on the OLD PC to download backup file</li>
              <li><strong>Transfer:</strong> Copy the backup file to the NEW PC (USB, email, etc.)</li>
              <li><strong>Import:</strong> On the NEW PC, click "Import Data" and select the backup file</li>
              <li><strong>Restart:</strong> Close and reopen the app to see imported data</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="card card-red">
        <div className="title mb-3">📤 Export Data (OLD PC)</div>
        <div className="text-sm opacity-80 mb-4">
          Download all your shop data (customers, invoices, products, expenses, etc.) as a backup file.
        </div>
        <button 
          className="btn btn-red" 
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? '⏳ Exporting...' : '📥 Download Backup File'}
        </button>
      </div>

      {/* Import Section */}
      <div className="card card-red">
        <div className="title mb-3">📥 Import Data (NEW PC)</div>
        <div className="text-sm opacity-80 mb-4">
          Upload a backup file to restore your shop data on a new computer.
          <br />
          <strong className="text-[#d32f2f]">⚠️ Warning: This will REPLACE all current data!</strong>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm opacity-80 block mb-2">Select Backup File</label>
            <input 
              type="file" 
              accept=".json"
              onChange={handleFileUpload}
              className="input w-full"
              disabled={importing}
            />
          </div>

          {previewData && (
            <div className="p-3 bg-[rgba(31,58,138,0.05)] rounded-lg">
              <div className="font-semibold mb-2">Preview:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>Customers: <strong>{previewData.customers || 0}</strong></div>
                <div>Invoices: <strong>{previewData.invoices || 0}</strong></div>
                <div>Products: <strong>{previewData.products || 0}</strong></div>
                <div>Expenses: <strong>{previewData.expenses || 0}</strong></div>
                <div>Payments: <strong>{previewData.payments || 0}</strong></div>
                <div>Quick Items: <strong>{previewData.quick_items || 0}</strong></div>
                <div>Credit Entries: <strong>{previewData.credit_entries || 0}</strong></div>
              </div>
            </div>
          )}

          <button 
            className="btn btn-red w-full" 
            onClick={handleImport}
            disabled={!importData || importing}
          >
            {importing ? '⏳ Importing...' : '📤 Import Data'}
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="card">
          <pre className="text-sm whitespace-pre-wrap">{message}</pre>
        </div>
      )}

      {/* Additional Info */}
      <div className="card" style={{ backgroundColor: 'rgba(31,58,138,0.04)' }}>
        <div className="text-sm opacity-80 space-y-2">
          <div className="font-semibold">📋 What's included in backup:</div>
          <ul className="ml-4 space-y-1 text-xs">
            <li>✓ All customers and their details</li>
            <li>✓ All invoices and invoice items</li>
            <li>✓ All products (from Add Product page)</li>
            <li>✓ All expenses records</li>
            <li>✓ All payment records</li>
            <li>✓ Quick add items</li>
            <li>✓ Credit book entries</li>
          </ul>
          <div className="mt-3 text-xs opacity-70">
            <strong>Note:</strong> Shop branding (logo, shop name) and license are NOT included in backup. 
            You'll need to set those up separately on the new PC.
          </div>
        </div>
      </div>
    </div>
  );
}
