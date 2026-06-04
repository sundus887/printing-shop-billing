import React, { useEffect, useState } from 'react';

export default function MachineId() {
  const [machineId, setMachineId] = useState('');
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    window.api.getMachineId()
      .then(res => {
        if (res && res.success) setMachineId(res.machineId || '');
        else setError('Machine ID load nahi ho saka.');
      })
      .catch(() => setError('Error loading Machine ID.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="bg-white border border-[rgba(31,58,138,0.15)] rounded-2xl p-8 shadow-sm">

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-[rgba(31,58,138,0.08)] border border-[rgba(31,58,138,0.20)] text-xl">
            🔑
          </div>
          <h1 className="text-xl font-semibold text-[#1f3a8a]">License Activation</h1>
        </div>

        <p className="text-sm text-[#1f3a8a]/70 mb-6">
          Send this Machine ID to the software provider to receive your activation license.
        </p>

        {loading && (
          <div className="text-sm text-[#1f3a8a]/50 py-4 text-center">Loading...</div>
        )}

        {error && (
          <div className="text-sm text-red-500 py-4 text-center">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-4">
              <label className="text-xs font-medium text-[#1f3a8a]/60 uppercase tracking-wide mb-2 block">
                Your Machine ID
              </label>
              <div className="bg-[rgba(31,58,138,0.04)] border border-[rgba(31,58,138,0.15)] rounded-xl px-4 py-3 font-mono text-sm text-[#1f3a8a] break-all select-all">
                {machineId || '—'}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl bg-[rgba(31,58,138,0.08)] border border-[rgba(31,58,138,0.20)] text-[#1f3a8a] font-medium hover:bg-[rgba(31,58,138,0.14)] transition text-sm"
            >
              {copied ? '✓ Copied!' : 'Copy Machine ID'}
            </button>
          </>
        )}

        <div className="mt-6 p-3 bg-[rgba(31,58,138,0.04)] rounded-xl border border-[rgba(31,58,138,0.10)]">
          <p className="text-xs text-[#1f3a8a]/60">
            💡 Copy this ID and send it to your software provider via WhatsApp or email. They will generate a license key for your computer.
          </p>
        </div>
      </div>
    </div>
  );
}