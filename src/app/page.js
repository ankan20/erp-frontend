"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE } from "@/config/role.config";
import { clearAuthCookies, getCookie } from "@/lib/cookies";
import { setCookie } from "@/lib/cookies";
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getCookie("token");
    const role = getCookie("role");

    if (!token) {
      router.replace("/login");
      return;
    }

    // ROLE BASED REDIRECT
    if (role === ROLE.SUPER_ADMIN) {
      router.replace("/settings/company-details");
      return;
    }

    if (role === ROLE.ADMIN) {
      router.replace("/master/vendor-code");
      return;
    }

    // USER → stay here (show project list)
  }, []);

  return (
    <div className="p-6">
      {/* USER PROJECT LIST UI */}
      <h1 className="text-xl font-semibold mb-4">Select Project</h1>

      <table className="w-full border border-gray-400 text-sm">
        <thead className="bg-gray-200">
          <tr>
            <th className="border px-2 py-1">Sl</th>
            <th className="border px-2 py-1">Project Name</th>
            <th className="border px-2 py-1">Project Code</th>
          </tr>
        </thead>

        <tbody>
          {[1, 2, 3].map((_, i) => (
            <tr
              key={i}
              className="hover:bg-gray-100 cursor-pointer"
              onClick={() => handleProjectSelect(i)}
            >
              <td className="border px-2 py-1">{i + 1}</td>
              <td className="border px-2 py-1">Project {i + 1}</td>
              <td className="border px-2 py-1">PRJ00{i + 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  function handleProjectSelect(index) {
    // simulate allowed modules
    const modules = ["finance", "inventory"];

    setCookie("modules", JSON.stringify(modules));

    // redirect to first module page
    router.push("/finance/sales");
  }
}