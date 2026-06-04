import React, { useEffect, useState } from 'react';

export default function ActivationScreen({ onActivated }) {
  const [machineId, setMachineId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMachineId = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.api.getMachineId();
      if (res && res.success && res.machineId) {
        setMachineId(res.machineId);
      } else {
        setError(res?.error || 'Machine ID load nahi ho saka. Retry karein.');
      }
    } catch (err) {
      setError('Machine ID load me error: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMachineId(); }, []);

  const handleCopy = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    setActivating(true);
    setError('');
    setSuccess('');

    try {
      const result = await window.api.licenseActivate(licenseKey.trim());
      
      if (result.success) {
        setSuccess('License activated successfully! Redirecting...');
        setTimeout(() => {
          if (onActivated) onActivated();
        }, 2000);
      } else {
        setError(result.error || 'Activation failed. Please check your license key.');
      }
    } catch (err) {
      setError('Activation failed: ' + err.message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1f3a8a] to-[#0f1e4d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#1f3a8a] to-[#2d4fa0] grid place-items-center text-4xl shadow-lg">
            🖨️
          </div>
          <h1 className="text-3xl font-bold text-[#1f3a8a] mb-2">
            PrintShop Billing
          </h1>
          <p className="text-lg text-[#d32f2f] font-semibold">
            Software Not Activated
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#1f3a8a] border-t-transparent"></div>
            <p className="mt-4 text-[#1f3a8a]/70">Loading Machine ID...</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && (
          <>
            {/* Machine ID Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1f3a8a] mb-2">
                Your Machine ID:
              </label>
              <div className="bg-[#f8f9fa] border-2 border-[#1f3a8a]/20 rounded-xl p-4 font-mono text-sm text-[#1f3a8a] break-all mb-2 min-h-[60px] flex items-center">
                {machineId ? (
                  <span className="select-all">{machineId}</span>
                ) : (
                  <span className="text-red-500 text-center w-full">Machine ID not available</span>
                )}
              </div>
              {machineId ? (
                <button
                  onClick={handleCopy}
                  className="w-full py-3 rounded-xl bg-[#1f3a8a] text-white font-semibold hover:bg-[#2d4fa0] transition"
                >
                  {copied ? 'Copied!' : 'Copy Machine ID'}
                </button>
              ) : (
                <button
                  onClick={loadMachineId}
                  className="w-full py-3 rounded-xl bg-[#d32f2f] text-white font-semibold hover:bg-[#b71c1c] transition"
                >
                  Retry Loading Machine ID
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-[rgba(31,58,138,0.05)] border border-[rgba(31,58,138,0.15)] rounded-xl p-4 mb-6">
              <p className="text-sm text-[#1f3a8a]/80 mb-2">
                <strong>Next Steps:</strong>
              </p>
              <ol className="text-sm text-[#1f3a8a]/70 space-y-1 ml-4 list-decimal">
                <li>Copy the Machine ID above</li>
                <li>Send it to your software provider via WhatsApp</li>
                <li>Provider will give you a license key</li>
                <li>Paste the license key below</li>
                <li>Click "Activate Software" button</li>
              </ol>
            </div>

            {/* License Input Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1f3a8a] mb-2">
                Paste License Key:
              </label>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste your license key here..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-[#1f3a8a]/20 rounded-xl font-mono text-sm focus:outline-none focus:border-[#1f3a8a] resize-none"
                disabled={activating}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-[#fee] border-2 border-[#d32f2f] rounded-xl p-4 mb-6">
                <p className="text-sm text-[#d32f2f] font-semibold">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-[#e8f5e9] border-2 border-[#2e7d32] rounded-xl p-4 mb-6">
                <p className="text-sm text-[#2e7d32] font-semibold">{success}</p>
              </div>
            )}

            {/* Activate Button */}
            <button
              onClick={handleActivate}
              disabled={activating || !licenseKey.trim()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#2e7d32] to-[#388e3c] text-white font-bold text-lg hover:from-[#388e3c] hover:to-[#43a047] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {activating ? 'Activating...' : 'Activate Software'}
            </button>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-[#1f3a8a]/60">
              <p>
                Contact: WhatsApp +92 300 1234567 | Email: support@printshop.com
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
