"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import UserForm from "@/components/user-id-password/UserForm";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

const Page = () => {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const router = useRouter();
  const actions = getPageActions({
    router,
  });

  // FETCH USER
  useEffect(() => {
    if (!id) return;

    const fetchUser = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_USER_BY_ID}/${id}`,
          method: "GET",
        });

        const data = res.data[0];

        setUserData(data);
      } catch (err) {
        toast.error("Failed to fetch user details");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  //  LOADER
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  //  FORM
  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <UserForm mode="edit" data={userData} />
      </HeaderWrapper>
    </>
  );
};

export default Page;
