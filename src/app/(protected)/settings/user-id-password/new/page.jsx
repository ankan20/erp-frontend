"use client";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import UserForm from "@/components/user-id-password/UserForm";
import { useRouter } from "next/navigation";
import React from "react";

export default function Page() {
  const router = useRouter();
  const actions = getPageActions({
    router,
  });
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <UserForm />
      </HeaderWrapper>
    </>
  );
}
