import { getDashboardPerformanceStats } from '@/query/dashboardQuery'
import { Activity, AlertTriangle, CalendarClock, FileCheck2, FileText, Gauge, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import authOptions from '@/lib/auth'
import { cn } from '@heroui/react'

// --- Helpers ---
const formatInteger = (value: number) => new Intl.NumberFormat('en-US').format(value)
const formatRate = (value: number) => `${value.toFixed(2)}%`
const formatSpeed = (value: number) => `${value.toFixed(2)} docs/sec`
const formatAverageTimePerDocument = (value: number) => {
    if (value <= 0) return 'N/A'
    return `${(1 / value).toFixed(2)} sec/doc`
}
const formatDateTime = (value: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(value)

const getDelta = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100
    return ((current - previous) / previous) * 100
}

/**
 * Enhanced Delta Label to handle color logic
 */
const getDeltaTrend = (value: number, reverse = false) => {
    if (Math.abs(value) < 0.1) return { label: 'Stable', color: 'text-default-400', icon: Minus }
    
    const isGood = reverse ? value < 0 : value > 0
    const Icon = value > 0 ? ArrowUpRight : ArrowDownRight
    
    return {
        label: `${Math.abs(value).toFixed(1)}%`,
        color: isGood ? 'text-success' : 'text-danger',
        icon: Icon
    }
}

// --- Components ---

const MetricCard = ({ title, value, subValue, extraValue, delta, icon: Icon, reverse = false, iconColor = "text-secondary" }: any) => {
    const trend = getDeltaTrend(delta, reverse)
    const TrendIcon = trend.icon

    return (
        <section className="rounded-xl border border-default-100 bg-content1 p-6 shadow-sm transition-hover hover:shadow-md">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-default-500">{title}</p>
                    <h3 className="mt-1 text-2xl font-bold tracking-tight">{value}</h3>
                    {extraValue ? (
                        <p className="mt-1 text-xs text-default-500">{extraValue}</p>
                    ) : null}
                </div>
                <div className={cn("rounded-lg bg-default-50 p-2.5", iconColor)}>
                    <Icon size={20} />
                </div>
            </div>
            
            <div className="mt-4 flex items-center gap-3">
                <div className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium bg-default-50", trend.color)}>
                    <TrendIcon size={14} />
                    {trend.label}
                </div>
                <p className="text-xs text-default-400">vs. last month ({subValue})</p>
            </div>
        </section>
    )
}

const DashboardPage = async () => {
    const session = await getServerSession(authOptions)
    const currentUserId = (session?.user as any)?.currentBusinessProfile?.id as string | undefined

    const {
        allTime,
        last30Days,
        previous30Days,
        pendingTemplateApprovals,
        scheduledCampaigns,
        errorCampaigns,
        pendingTemplateApprovalList,
        hasMoreScheduledCampaigns,
        hasMoreErrorCampaigns,
        hasMorePendingTemplateApprovals,
    } = await getDashboardPerformanceStats(currentUserId)

    const documentDelta = getDelta(last30Days.documentsGenerated, previous30Days.documentsGenerated)
    const errorRateDelta = getDelta(last30Days.errorRate, previous30Days.errorRate)
    const speedDelta = getDelta(last30Days.processingSpeed, previous30Days.processingSpeed)

    return (
        <div className="flex flex-col gap-4 px-6 py-4">
            {/* Header */}
            <header className="flex flex-col gap-2">
                <h1 className="font-bold text-xl">Performance Overview</h1>
                <p className="text-default-400 text-small">Real-time insights into your document generation pipeline.</p>
            </header>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <MetricCard 
                    title="Documents Generated" 
                    value={formatInteger(allTime.documentsGenerated)}
                    subValue={formatInteger(previous30Days.documentsGenerated)}
                    delta={documentDelta}
                    icon={FileText}
                    iconColor="text-blue-500"
                />
                <MetricCard 
                    title="Avg. Error Rate" 
                    value={formatRate(allTime.errorRate)}
                    subValue={formatRate(previous30Days.errorRate)}
                    delta={errorRateDelta}
                    icon={AlertTriangle}
                    reverse
                    iconColor="text-amber-500"
                />
                <MetricCard 
                    title="Processing Speed" 
                    value={formatSpeed(allTime.processingSpeed)}
                    subValue={formatSpeed(previous30Days.processingSpeed)}
                    extraValue={`Avg time: ${formatAverageTimePerDocument(allTime.processingSpeed)}`}
                    delta={speedDelta}
                    icon={Gauge}
                    iconColor="text-purple-500"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Scheduled Campaigns */}
                <section className="flex flex-col rounded-xl border border-default-100 bg-content1 shadow-sm">
                    <div className="flex items-center justify-between border-b border-default-100 p-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <CalendarClock size={18} className="text-default-400" />
                            Scheduled Campaigns
                        </div>
                        {(hasMoreScheduledCampaigns || hasMoreErrorCampaigns) && (
                            <Link href="/campaigns" className="text-xs font-medium text-secondary hover:underline">to campaigns</Link>
                        )}
                    </div>
                    <div className="pb-2">
                    {scheduledCampaigns.length > 0 || errorCampaigns.length > 0 ? (
                        <div className="flex flex-col">
                            <div className="divide-y divide-default-100">
                                {/* 1. Render Errors first to grab attention */}
                                {errorCampaigns.map((campaign) => (
                                    <Link 
                                        key={campaign.id} 
                                        href={`/campaigns/${campaign.id}`}
                                        className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-danger-50/30"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
                                            <p className="truncate text-sm font-medium text-default-700 group-hover:text-danger-600">
                                                {campaign.name}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-danger-600 bg-danger-50 px-2 py-0.5 rounded">
                                                Error
                                            </span>
                                            <ArrowUpRight size={14} className="text-default-300 opacity-0 transition-all group-hover:opacity-100 group-hover:text-danger-600" />
                                        </div>
                                    </Link>
                                ))}

                                {/* 2. Render Scheduled / Overdue next */}
                                {scheduledCampaigns.map((campaign) => (
                                    <Link 
                                        key={campaign.id} 
                                        href={`/campaigns/${campaign.id}`}
                                        className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-default-50/50"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", campaign.isOverdue ? "bg-warning" : "bg-secondary")} />
                                            <p className="truncate text-sm font-medium text-default-700 group-hover:text-secondary">
                                                {campaign.name}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0">
                                            {campaign.isOverdue && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-warning-600 bg-warning-50 px-2 py-0.5 rounded">
                                                    Overdue
                                                </span>
                                            )}
                                            <p className="text-xs text-default-400 tabular-nums">
                                                {formatDateTime(campaign.scheduledAt)}
                                            </p>
                                            <ArrowUpRight size={14} className="text-default-300 opacity-0 transition-all group-hover:opacity-100 group-hover:text-secondary" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <p className="text-sm text-default-400">No active or scheduled campaigns.</p>
                        </div>
                    )}
                </div>
                </section>

                {/* Pending Approvals */}
                <section className="flex flex-col rounded-xl border border-default-100 bg-content1 shadow-sm">
                    <div className="flex items-center justify-between border-b border-default-100 p-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <FileCheck2 size={18} className="text-default-400" />
                            Pending Approvals
                        </div>
                    </div>
                    <div className="pb-2">
                        {pendingTemplateApprovalList.length > 0 ? (
                            <div className="flex flex-col">
                                <div className="divide-y divide-default-100">
                                    {pendingTemplateApprovalList.map((template) => (
                                        <Link 
                                            key={template.templateId} 
                                            href={`/templates/${template.templateId}`}
                                            className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-default-50/50"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-1.5 w-1.5 rounded-full bg-warning" /> {/* Warning dot for approval */}
                                                <p className="truncate text-sm font-medium text-default-700 group-hover:text-secondary">
                                                    {template.templateTitle}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-warning-600 bg-warning-50 px-2 py-0.5 rounded-full">
                                                    Pending
                                                </span>
                                                <ArrowUpRight size={14} className="text-default-300 opacity-0 transition-all group-hover:opacity-100 group-hover:text-secondary" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-10 text-center">
                                <p className="text-sm text-default-400">All caught up! No pending templates.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Quality Snapshot Table */}
            <section className="rounded-xl border border-default-100 bg-content1 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-default-100 p-5 font-semibold">
                    <Activity size={18} className="text-default-400" />
                    Quality Snapshot
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-default-50 text-default-500 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Period</th>
                                <th className="px-6 py-3 font-semibold text-center">Campaigns</th>
                                <th className="px-6 py-3 font-semibold text-center">Failed</th>
                                <th className="px-6 py-3 font-semibold text-center">Error Rate</th>
                                <th className="px-6 py-3 font-semibold text-right">Processing Speed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                            {[
                                { label: 'All time', data: allTime },
                                { label: 'Last 30 days', data: last30Days },
                                { label: 'Previous 30 days', data: previous30Days },
                            ].map((row, idx) => (
                                <tr key={idx} className="hover:bg-default-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-default-700">{row.label}</td>
                                    <td className="px-6 py-4 text-center">{formatInteger(row.data.totalCampaigns)}</td>
                                    <td className="px-6 py-4 text-center text-danger-500">{formatInteger(row.data.failedCampaigns)}</td>
                                    <td className="px-6 py-4 text-center font-mono">{formatRate(row.data.errorRate)}</td>
                                    <td className="px-6 py-4 text-right font-medium">{formatSpeed(row.data.processingSpeed)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}

export default DashboardPage