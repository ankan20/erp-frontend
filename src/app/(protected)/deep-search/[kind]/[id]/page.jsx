"use client";

// 360 view of a vendor / ledger or an item — opened from the search box
// (Ctrl+K → "/v sharma" or "/i cement").  ?tab=ledger lands on a tab.

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import DeepSearchView from "@/components/deep-search/DeepSearchView";

const KINDS = ["vendor", "item"];

function Content() {
  const { kind, id } = useParams();
  const tab = useSearchParams().get("tab") || "";
  if (!KINDS.includes(kind) || !/^\d+$/.test(String(id))) return <PageNotAvailable />;
  // key: a different record starts fresh
  return <DeepSearchView key={`${kind}:${id}`} kind={kind} id={id} initialTab={tab} />;
}

export default function DeepSearchPage() {
  const router = useRouter();
  const actions = getPageActions({ router });

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </HeaderWrapper>
  );
}
