"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EdoxMark } from "@/components/common/EdoxLoader";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);


  const actions = getPageActions({

    router,

  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper
            header={<PageHeader actions={actions} />}
          >
            <p className="text-center mt-[20%] text-blue-400">Dashboard is not Ready</p>
      </HeaderWrapper>
    </>

  );
}