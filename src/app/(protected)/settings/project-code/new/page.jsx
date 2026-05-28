"use client";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import ProjectForm from "@/components/project-code/ProjectCodeForm";
import { useRouter } from "next/navigation";
import React from "react";

const Page = () => {
  const router = useRouter();
  const actions = getPageActions({
    router,
  });
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <ProjectForm />
      </HeaderWrapper>
    </>
  );
};

export default Page;
