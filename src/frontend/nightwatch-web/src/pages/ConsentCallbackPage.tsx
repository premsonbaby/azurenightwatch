import { useEffect, useState } from 'react';

export function ConsentCallbackPage() {
  const [status, setStatus] = useState<'success' | 'error' | 'pending'>('pending');
  const [tenantName, setTenantName] = useState<string>('');
  const [errorDetail, setErrorDetail] = useState<string>('');

  const [alreadyConsented, setAlreadyConsented] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const consent = params.get('admin_consent');
    const tenant = params.get('tenant');
    const error = params.get('error');
    const errorDesc = params.get('error_description') ?? error ?? '';

    if (error) {
      // AADSTS650051 = service principal already exists → consent was previously granted
      if (errorDesc.includes('AADSTS650051')) {
        setAlreadyConsented(true);
        setStatus('success');
        setTenantName(tenant ?? '');
      } else {
        setStatus('error');
        setErrorDetail(errorDesc);
      }
    } else if (consent?.toLowerCase() === 'true') {
      setStatus('success');
      setTenantName(tenant ?? '');
    } else {
      setStatus('success');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-8 text-center shadow-2xl">
        <img src="/nightwatch-icon.svg" alt="NightWatch" className="mx-auto mb-6 h-16 w-16 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />

        {status === 'pending' && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-white">
              {alreadyConsented ? 'Already Authorised' : 'Consent Granted'}
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              {alreadyConsented
                ? 'NightWatch is already authorised in this Azure tenant — no action needed.'
                : 'NightWatch has been authorised in your Azure tenant.'}
              {tenantName && <span className="block mt-1 font-mono text-xs text-slate-500">{tenantName}</span>}
            </p>
            <div className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-left text-xs text-cyan-200 space-y-2">
              <p className="font-semibold uppercase tracking-wide text-cyan-300">Next step for your Azure admin</p>
              <p>Assign these roles to <strong>NightWatch MSP</strong> at the <strong>Root Management Group</strong> level via <strong>IAM → Add role assignment</strong>:</p>
              <ul className="ml-3 list-disc space-y-1 text-slate-300">
                <li>Reader</li>
                <li>Security Reader</li>
                <li>Cost Management Reader</li>
                <li>Log Analytics Reader</li>
              </ul>
            </div>
            <p className="mt-6 text-xs text-slate-500">You can close this tab.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-white">Consent Failed</h1>
            <p className="mt-3 text-sm text-red-300">{errorDetail || 'The admin consent request was not completed.'}</p>
            <p className="mt-4 text-xs text-slate-500">Please contact your NightWatch administrator and share this error message.</p>
          </>
        )}
      </div>
    </div>
  );
}
