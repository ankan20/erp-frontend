"use client"
import { getPageActions } from '@/components/common/PageActionButtons'
import HeaderWrapper from '@/components/layout/HeaderWrapper'
import PageHeader from '@/components/layout/PageHeader'
import ProjectForm from '@/components/project-code/ProjectCodeForm'
import { useRouter } from 'next/navigation'
import React from 'react'

const Page = () => {
  const router = useRouter();
  const actions = getPageActions({
        
        onHome: () => router.push("/dashboard"),
        onBack: () => router.back(),
        
      });
  return (
    <div>
      <HeaderWrapper
            header={<PageHeader actions={actions} />}
          >
        <ProjectForm />
        </HeaderWrapper>
    </div>
  )
}

export default Page
