"use client";

import { useMemo, useState ,useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tcodeConfig } from "@/config/tcode.config";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import Image from "next/image";
import { routeMetaConfig } from "@/config/route-meta.config";
import { toast } from "sonner";
import { setCookie } from "@/lib/cookies";
import { getCookie } from "@/lib/cookies";

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [tcode, setTcode] = useState("");
  const [mounted, setMounted] = useState(false);

  const [projectInfo, setProjectInfo] = useState({
    projectCode: "",
    clientName: "",
    projectName: "",
  });

  const [username, setUsername] = useState("");

  useEffect(() => {
    // only one render trigger
    setMounted(true);

    // safe client-only logic
    try {
      const storedProject = setCookie("projectInfo");
      const storedUser = getCookie("userName");

      if (storedProject) {
        const parsed = JSON.parse(storedProject);
        setProjectInfo(parsed);
      }

      if (storedUser) {
        setUsername(storedUser);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const breadcrumbs = useMemo(
    () => getBreadcrumbs(pathname, routeMetaConfig),
    [pathname]
  );

  const handleTCodeNavigate = () => {
    const route = tcodeConfig[tcode.toLowerCase().trim()];
    if (route) {
      router.push(route);
      setTcode("");
    } else {
      toast.error("no match found!");
    }
  };

  //prevents hydration mismatch
  if (!mounted) return null;


  return (
    <div className="w-full border border-[#c4d1df] bg-[#efefef]">
      {/* TOP SECTION */}
      <div className="flex flex-col lg:flex-row justify-between px-4 lg:px-6 pt-2 gap-4">

        {/* LEFT */}
        <div className="flex flex-col">
          {/* Branding */}
          <div className="leading-tight">
            <div className="flex items-end gap-1">
              <span className="text-[22px] lg:text-[24px] font-extrabold text-[#003b8e]">
                PRAX
              </span>
              <span className="text-[13px] lg:text-[14px] font-bold">
                CONSTRUCTION
              </span>
              <span className="text-[13px] lg:text-[14px] font-bold text-red-600">
                ERP
              </span>
            </div>

            <div className="mt-0.5 text-[15px] lg:text-[18px] font-bold">
              Company: Dishaan Hi-tech (India) Pvt. Ltd.
            </div>
          </div>

          <div className="mt-2 h-[1px] w-full lg:w-130 bg-[#b8c7da]" />

          {/* ICONS + TCODE */}
          <div className="mt-4 flex items-center">

            {/* LEFT ICONS */}
            <div className="flex items-center gap-2">
              <button className="cursor-pointer">
                <Image src="/assets/icons/home.png" alt="" width={32} height={32} />
              </button>
              <button className="cursor-pointer">
                <Image src="/assets/icons/settings.png" alt="" width={32} height={32} />
              </button>
              <button className="cursor-pointer">
                <Image src="/assets/icons/computer-monitor.png" alt="" width={32} height={32} />
              </button>
            </div>

            {/* 🔥 SPACE BETWEEN ICONS AND TCODE */}
            <div className="ml-10 lg:ml-16 flex items-center gap-2">
              <span className="text-sm">T. Code</span>

              <input
                value={tcode}
                onChange={(e) => setTcode(e.target.value)}
                className="h-6 w-25 border border-[#d5b7a2] bg-[#eef0a7] px-2 text-sm outline-none"
              />

              <button onClick={handleTCodeNavigate} className="cursor-pointer">
                <Image
                  src="/assets/icons/red-right-arrow.png"
                  alt=""
                  width={28}
                  height={28}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full lg:w-150 text-[13px] lg:text-[14px] leading-5 lg:leading-6">

          {/* ROW */}
          <div className="flex">
            <span className="min-w-27.5 lg:min-w-32.5 font-bold">
              Project Code
            </span>
            <span className="mr-2">:</span>
            <span className="font-bold break-words">
              {projectInfo.projectCode || "-"}
            </span>
          </div>

          <div className="flex">
            <span className="min-w-[110px] lg:min-w-[130px] font-bold">
              Client Name
            </span>
            <span className="mr-2">:</span>
            <span className="font-bold text-red-600 break-words">
              {projectInfo.clientName || "-"}
            </span>
          </div>

          <div className="flex">
            <span className="min-w-[110px] lg:min-w-[130px] font-bold">
              Project Name
            </span>
            <span className="mr-2">:</span>
            <span className="break-words">
              {projectInfo.projectName || "-"}
            </span>
          </div>

          <div className="flex">
            <span className="min-w-[110px] lg:min-w-[130px] font-bold">
              User
            </span>
            <span className="mr-2">:</span>
            <span className="wrap-break-words">
              {username || "-"}
            </span>
          </div>

        </div>
      </div>

      {/* BOTTOM */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-4 lg:px-6 py-2 gap-2">

        {/* BREADCRUMB */}
        <div className="text-[14px] lg:text-[16px] font-semibold">
          <span>Modules : </span>

          {breadcrumbs.map((crumb, index) => (
            <span key={crumb}>
              {index !== 0 && " > "}
              <span className={index === breadcrumbs.length - 1 ? "text-red-600" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </div>

        {/* ACTION ICONS */}
        <div className="flex items-center gap-2">
          <button className="cursor-pointer"><Image src="/assets/icons/home.png" alt="" width={32} height={32} /></button>
          <button className="cursor-pointer"><Image src="/assets/icons/left-arrow.png" alt="" width={32} height={32} /></button>
          <button className="cursor-pointer"><Image src="/assets/icons/file-download.png" alt="" width={32} height={32} /></button>
          <button className="cursor-pointer"><Image src="/assets/icons/database.png" alt="" width={32} height={32} /></button>
        </div>
      </div>
    </div>
  );
}