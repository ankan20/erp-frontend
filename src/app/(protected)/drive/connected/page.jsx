"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { finishConnect } from "@/lib/edoxDrive";

// Edox Drive sends people here after they approve the link (?code=…).
function Connected() {
  const code = useSearchParams().get("code");
  const [state, setState] = useState({ kind: "working" });
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;          // the code works once (React may run effects twice in development)
    done.current = true;
    if (!code) {
      setState({ kind: "error", message: "No code from Edox Drive. Start again from My profile." });
      return;
    }
    finishConnect(code).then((d) => setState({ kind: "ok", user: d.drive_user }))
      .catch((e) => setState({ kind: "error", message: e.message }));
  }, [code]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        {state.kind === "working" && <><EdoxMark size={40} className="mx-auto" /><p className="mt-3 text-[14px] text-gray-600">Connecting Edox Drive…</p></>}
        {state.kind === "ok" && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
            <h1 className="mt-3 font-semibold text-gray-800">Edox Drive is connected</h1>
            <p className="mt-1 text-[13px] text-gray-500">Linked to {state.user?.name} ({state.user?.email}). You can now attach files from Drive and save attachments to it.</p>
            <Link href="/my-profile" className="mt-5 inline-flex px-4 h-9 items-center rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700">Back to My profile</Link>
          </>
        )}
        {state.kind === "error" && (
          <>
            <XCircle className="w-10 h-10 mx-auto text-red-500" />
            <h1 className="mt-3 font-semibold text-gray-800">Couldn&apos;t connect</h1>
            <p className="mt-1 text-[13px] text-gray-500">{state.message}</p>
            <Link href="/my-profile" className="mt-5 inline-flex px-4 h-9 items-center rounded-lg border border-gray-200 text-[13px] hover:bg-gray-50">Back to My profile</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function DriveConnectedPage() {
  return <Suspense><Connected /></Suspense>;
}
