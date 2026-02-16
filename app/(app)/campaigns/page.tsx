import CampaignControlBar from '@/components/campaigns/CampaignControlBar'
import { CampaignTable } from '@/components/campaigns/CampaignTable'
import { Suspense } from 'react'

const CampaignPage = () => {
    return (
         <Suspense>
            <div className='flex flex-col gap-4 px-6 py-4'>
                <div className='flex flex-col gap-2'>
                    <h1 className="font-bold text-xl">Campaigns</h1>
                    <p className="text-default-400 text-small">Schedule and track bulk PDF generation tasks</p>
                </div>
                <CampaignControlBar />
                <CampaignTable />
            </div>
        </Suspense>
    )
}

export default CampaignPage