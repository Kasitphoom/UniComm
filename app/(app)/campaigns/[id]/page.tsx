import { Suspense } from "react"
import { notFound } from "next/navigation"
import CampaignDetailView from "@/components/campaigns/CampaignDetailView"
import { getCampaignDetail } from "@/query/campaignQuery"

type PageParams = {
    params: Promise<{ id: string }>
}

const CampaignDetailPage = async ({ params }: PageParams) => {
    const { id } = await params

    if (!id) {
        notFound()
    }

    const campaign = await getCampaignDetail(id)

    if (!campaign) {
        notFound()
    }

    return (
        <Suspense>
            <div className="flex flex-col gap-4 px-6 min-h-full">
                <CampaignDetailView campaign={campaign} />
            </div>
        </Suspense>
    )
}

export default CampaignDetailPage
