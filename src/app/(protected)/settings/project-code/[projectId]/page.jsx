"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ProjectForm from "@/components/project-code/ProjectCodeForm";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

const Page = () => {
  const { projectId } = useParams();

  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const router = useRouter();
  const actions = getPageActions({
          
          onHome: () => router.push("/dashboard"),
          onBack: () => router.back(),
          
        });

  //  FETCH USER 
  useEffect(() => {
    if (!projectId) return;

    const fetchProjectDetails = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,
          method: "GET",
        });

        const apiData  = res.data[0];
        const { id, ...formData } = apiData;

        setProjectData(formData);
      } catch (err) {
        toast.error("Failed to fetch project details");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId]);

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
    <div>
      <HeaderWrapper
            header={<PageHeader actions={actions} />}
          >
      <ProjectForm mode="edit" data={projectData} projectId={projectId}/>
      </HeaderWrapper>
    </div>
  );
};

export default Page;