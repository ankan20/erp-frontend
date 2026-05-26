"use client";

import { useRouter } from "next/navigation";

import HeaderWrapper from "@/components/layout/HeaderWrapper";

import PageHeader from "@/components/layout/PageHeader";

import {
  getPageActions,
} from "@/components/common/PageActionButtons";

import PageNotAvailable from "@/components/common/PageNotAvailable";

import { getPageAccess } from "@/helper/getPageAccess";

import OrderForm from "@/components/resource/order/OrderForm";

export default function Page() {

  const router =
    useRouter();

  const access =
    getPageAccess({

      pageCode:
        "order",

      pageType:
        "ADD",
    });

  if (
    !access.allowed
  ) {

    return (
      <PageNotAvailable />
    );
  }

  const actions =
    getPageActions({

      router,

      onBack: () =>
        router.back(),
    });

  return (

    <HeaderWrapper
      header={
        <PageHeader
          actions={
            actions
          }
        />
      }
    >

      <OrderForm
        mode={
          access.mode
        }
      />

    </HeaderWrapper>
  );
}