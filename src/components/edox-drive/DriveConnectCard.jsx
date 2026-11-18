"use client";

import { CheckCircle2, ExternalLink, HardDrive, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { driveStatus, startConnect } from "@/lib/edoxDrive";

function size(n) {
  if (n == null) return "";
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// My profile → Edox Drive: shows the link, or lets the person connect once.
export default function DriveConnectCard() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    driveStatus(true).then(setStatus);
    const again = () => driveStatus(true).then(setStatus);     // back from the Drive tab
    window.addEventListener("focus", again);
    return () => window.removeEventListener("focus", again);
  }, []);

  if (!status?.enabled) return null;
  const u = status.drive_user;
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><HardDrive className="w-5 h-5 text-violet-600" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800">Edox Drive</h3>
          {status.linked ? (
            <>
              <p className="text-[13px] text-gray-600 mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Connected as <b className="truncate">{u.name}</b> <span className="text-gray-400 truncate">({u.email})</span>
              </p>
              <p className="text-[12px] text-gray-400 mt-1">{size(u.used_bytes)} of {size(u.quota_bytes)} used · To change the linked account, ask the Drive super admin.</p>
            </>
          ) : (
            <p className="text-[13px] text-gray-500 mt-0.5">Attach files from your Drive in any upload box, save ERP attachments to your Drive, and see your project documents in Drive.</p>
          )}
        </div>
        {status.linked ? (
          <a href={status.drive_url} target="_blank" rel="noreferrer"
             className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50">
            Open Drive <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              window.open(await startConnect(), "_blank", "noopener");
            } catch (e) {
              toast.error(e.message);
            }
            setBusy(false);
          }} className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
            <Link2 className="w-4 h-4" /> Connect
          </button>
        )}
      </div>
    </section>
  );
}
