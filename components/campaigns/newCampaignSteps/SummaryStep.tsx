"use client"

import { Calendar, Users, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getLocalTimeZone } from '@internationalized/date'
import { Divider, Chip } from '@heroui/react'
import type { DateValue } from '@heroui/react'
import TemplateSelectionCard from './TemplateSelectionCard'
import type { TemplateWithUser } from '@/types/template'
import type { ContactListDTO } from '@/features/customers/types'

type SummaryStepProps = {
    campaignName: string
    template: TemplateWithUser | null
    customerList: ContactListDTO | null
    scheduleDate: DateValue | null
    isCustomerListCompatible: boolean | null
}

const InfoRow = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
    <div className="flex justify-between items-center py-1">
        <div className="flex items-center gap-2 text-default-400">
            <Icon size={14} strokeWidth={2} />
            <span className="text-tiny font-medium uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-small font-bold text-default-700 truncate max-w-[60%]">
            {value}
        </span>
    </div>
)

const SummaryStep = ({
    campaignName,
    template,
    customerList,
    scheduleDate,
    isCustomerListCompatible,
}: SummaryStepProps) => {
    const scheduleDateTime = scheduleDate ? scheduleDate.toDate(getLocalTimeZone()) : null
    const approvers = template?.approvers || []
    const totalApprovers = approvers.length
    const approvedCount = approvers.filter((approver) => approver.status === 'APPROVED').length
    const rejectedCount = approvers.filter((approver) => approver.status === 'REJECTED').length
    const hasApprovalWorkflow = totalApprovers > 0
    const approvalsRejected = rejectedCount > 0
    const approvalsComplete = hasApprovalWorkflow && approvedCount === totalApprovers && !approvalsRejected

    const approvalChecklist = (() => {
        if (!template) {
            return {
                isValid: false,
                isWarning: true,
                label: 'Template missing',
                description: 'Select a template to configure approvals and schedule delivery.',
            }
        }

        if (!hasApprovalWorkflow) {
            return {
                isValid: true,
                isWarning: false,
                label: 'No approval workflow required',
                description: 'Campaign will trigger on schedule once launched.',
            }
        }

        if (approvalsRejected) {
            return {
                isValid: false,
                isWarning: true,
                label: 'Approvals rejected — needs attention',
                description: 'Update the template and request approval again to resume automation.',
            }
        }

        if (approvalsComplete) {
            return {
                isValid: true,
                isWarning: false,
                label: 'Template fully approved',
                description: 'Automation will start exactly at the scheduled window.',
            }
        }

        return {
            isValid: false,
            isWarning: true,
            label: `Awaiting approvals ${approvedCount}/${totalApprovers}`,
            description: 'Campaign can be created now but will only trigger after all approvers sign off.',
        }
    })()

    return (
        <div className="grid gap-8 md:grid-cols-5 animate-in fade-in duration-500">
            {/* LEFT: THE BLUEPRINT (3 Columns) */}
            <div className="md:col-span-3 space-y-6">
                <div className="rounded-2xl border border-default-100 bg-content1/50 p-6 space-y-6">
                    {/* Header: Campaign Identity */}
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-medium font-bold tracking-tight">{campaignName || 'Untitled Campaign'}</h3>
                            <p className="text-tiny text-default-400 uppercase tracking-widest font-semibold">Campaign Blueprint</p>
                        </div>
                        {isCustomerListCompatible && (
                            <Chip color="secondary" variant="flat" startContent={<ShieldCheck size={14} />} className="font-bold border-1 border-secondary-100">
                                Verified
                            </Chip>
                        )}
                    </div>

                    <div className="space-y-3">
                        <InfoRow label="Template" value={template?.title || 'None selected'} icon={FileText} />
                        <InfoRow label="Audience" value={customerList?.name || 'None selected'} icon={Users} />
                        <InfoRow 
                            label="Schedule" 
                            value={scheduleDateTime 
                                ? `${scheduleDateTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} @ ${scheduleDateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                : 'Manual Trigger'} 
                            icon={Calendar} 
                        />
                    </div>

                    <Divider className="opacity-50" />

                    {/* Pre-launch Checklist */}
                    <div className="space-y-3">
                        <ChecklistItem 
                            isValid={approvalChecklist.isValid} 
                            isWarning={approvalChecklist.isWarning}
                            label={approvalChecklist.label}
                            description={approvalChecklist.description}
                        />
                        <ChecklistItem 
                            isValid={!!customerList && (customerList._count?.customers ?? 0) > 0} 
                            label={`Audience ready (${customerList?._count?.customers ?? 0} records)`} 
                        />
                        <ChecklistItem 
                            isValid={!!isCustomerListCompatible} 
                            isWarning={isCustomerListCompatible === false}
                            label={isCustomerListCompatible ? "Data mapping synchronized" : "Variable mismatch detected"} 
                        />
                    </div>
                </div>
            </div>

            {/* RIGHT: THE PREVIEW (2 Columns) */}
            <div className="md:col-span-2 space-y-3">
                <p className="text-tiny font-bold uppercase tracking-widest text-default-400 px-1">Visual Preview</p>
                {template ? (
                    <div className="pointer-events-none opacity-90 hover:opacity-100 transition-opacity">
                        <TemplateSelectionCard template={template} isSelected={false} onToggle={() => {}} />
                    </div>
                ) : (
                    <div className="aspect-video rounded-2xl border-2 border-dashed border-default-100 flex items-center justify-center text-default-300 text-tiny uppercase tracking-widest font-bold bg-default-50/50">
                        No Template Selected
                    </div>
                )}
            </div>
        </div>
    )
}

const ChecklistItem = ({ isValid, label, isWarning, description }: { isValid: boolean, label: string, isWarning?: boolean, description?: string }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
            <div className={`rounded-full p-0.5 ${isValid ? 'text-secondary' : isWarning ? 'text-warning' : 'text-default-200'}`}>
                {isValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            </div>
            <span className={`text-small font-medium ${isValid ? 'text-default-700' : 'text-default-400'}`}>
                {label}
            </span>
        </div>
        {description && (
            <p className="text-tiny text-default-400 ml-8">
                {description}
            </p>
        )}
    </div>
)

export default SummaryStep