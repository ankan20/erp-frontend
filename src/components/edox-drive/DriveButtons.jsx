"use client";

import { CloudUpload, HardDrive, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import DriveBrowser from "@/components/edox-drive/DriveBrowser";
import { driveStatus, saveToDrive, startConnect } from "@/lib/edoxDrive";

// Shows nothing until we know Edox Drive is set up for this ERP.
function useDriveStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    driveStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}

export function ConnectPrompt({ onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center"><Link2 className="w-5 h-5 text-violet-600" /></div>
        <h3 className="font-semibold text-gray-800">Connect Edox Drive first</h3>
        <p className="text-[13px] text-gray-500 mt-1">Link your ERP account to your Edox Drive account once. You sign in to Drive and approve.</p>
        <div className="flex gap-2 justify-center mt-5">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100">Not now</button>
          <button type="button" onClick={async () => {
            try {
              window.open(await startConnect(), "_blank", "noopener");
              onClose();
            } catch (e) {
              toast.error(e.message);
            }
          }} className="px-4 h-9 rounded-lg text-[13px] font-semibold bg-violet-600 text-white hover:bg-violet-700">Connect</button>
        </div>
      </div>
    </div>
  );
}

/** "From Edox Drive" — gives the chosen Drive file to `onFile(File)`, like the normal file picker. */
export function FromDriveButton({ accept, onFile, compact = false, disabled = false }) {
  const status = useDriveStatus();
  const [open, setOpen] = useState(null);
  if (!status?.enabled || disabled) return null;
  const click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // linked in another tab meanwhile? ask again before offering Connect
    if (status.linked) setOpen("browse");
    else driveStatus(true).then((s) => setOpen(s.linked ? "browse" : "connect"));
  };
  return (
    <>
      {compact ? (
        <button type="button" onClick={click} title="Attach from Edox Drive" aria-label="Attach from Edox Drive"
                className="inline-flex items-center justify-center shrink-0 h-[28px] w-[28px] rounded-[4px] border border-violet-300 bg-violet-50 hover:bg-violet-100 transition-colors">
          <HardDrive className="w-3.5 h-3.5 text-violet-700" />
        </button>
      ) : (
        <button type="button" onClick={click}
                className="mt-2 ml-2 px-4 py-1 rounded-lg border border-violet-300 bg-violet-50 text-[11px] font-semibold text-violet-700 shadow-sm hover:bg-violet-100 active:scale-[0.97] transition-all inline-flex items-center gap-1.5">
          <HardDrive className="w-3 h-3" /> From Edox Drive
        </button>
      )}
      {open === "connect" && <ConnectPrompt onClose={() => setOpen(null)} />}
      {open === "browse" && (
        <DriveBrowser mode="file" accept={accept} title="Attach from Edox Drive" onClose={() => setOpen(null)}
                      onPick={(file) => {
                        onFile(file);
                        toast.success(`"${file.name}" attached from Edox Drive`);
                      }} />
      )}
    </>
  );
}

/** "Save to Edox Drive" — copies an ERP attachment (its normal file URL) into a Drive folder. */
export function SaveToDriveButton({ url, name, compact = false }) {
  const status = useDriveStatus();
  const [open, setOpen] = useState(null);
  if (!status?.enabled || !url) return null;
  const click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // linked in another tab meanwhile? ask again before offering Connect
    if (status.linked) setOpen("browse");
    else driveStatus(true).then((s) => setOpen(s.linked ? "browse" : "connect"));
  };
  return (
    <>
      <button type="button" onClick={click} title="Save to Edox Drive" aria-label="Save to Edox Drive"
              className={compact
                ? "shrink-0 p-1 rounded text-violet-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                : "inline-flex items-center gap-1.5 text-[11.5px] font-medium text-violet-700 hover:underline"}>
        <CloudUpload className="w-3.5 h-3.5" />
        {!compact && "Save to Edox Drive"}
      </button>
      {open === "connect" && <ConnectPrompt onClose={() => setOpen(null)} />}
      {open === "browse" && (
        <DriveBrowser mode="folder" title="Save to Edox Drive" actionLabel="Save here" onClose={() => setOpen(null)}
                      onPick={async (folderId, folderName) => {
                        try {
                          const node = await saveToDrive(url, folderId, name);
                          toast.success(`Saved "${node.name}" to ${folderName}`);
                          return true;
                        } catch (e) {
                          toast.error(e.message);
                          return false;
                        }
                      }} />
      )}
    </>
  );
}
