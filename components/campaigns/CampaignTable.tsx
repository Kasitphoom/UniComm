"use client"
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, User, Tooltip } from "@heroui/react";
import { StatusCell } from "./StatusCell";
import { CampaignWithRelations } from "@/types/campaign";

export const CampaignTable = ({ campaigns, onEdit }: { campaigns: CampaignWithRelations[], onEdit: (item: CampaignWithRelations) => void }) => {
    return (
        <Table 
            aria-label="Campaign List" 
            removeWrapper 
            className="min-w-full"
            classNames={{ th: "bg-default-50 text-default-500", td: "py-4" }}
        >
            <TableHeader>
                <TableColumn>CAMPAIGN NAME</TableColumn>
                <TableColumn>TEMPLATES</TableColumn>
                <TableColumn>EXECUTION TIME</TableColumn>
                <TableColumn>RECORDS</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>FILES</TableColumn>
                <TableColumn align="center">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody items={campaigns}>
                {(item: CampaignWithRelations) => (
                    <TableRow key={item.id} className="hover:bg-default-50 transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                        <TableCell>
                            <span className="font-bold text-default-700">{item.name}</span>
                        </TableCell>
                        <TableCell>
                            <div className="flex -space-x-2">
                                {item.templates.map((ct, i) => (
                                    <Tooltip key={ct.id} content={ct.template.title}>
                                        <div className="w-8 h-8 rounded-full bg-secondary-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-secondary">
                                            {ct.template.title.charAt(0)}
                                        </div>
                                    </Tooltip>
                                ))}
                                {item.templates.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-default-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                                        +{item.templates.length - 3}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="text-small">{new Date(item.scheduledAt).toLocaleDateString()}</span>
                                <span className="text-tiny text-default-400">{new Date(item.scheduledAt).toLocaleTimeString()}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <span className="text-small font-medium">{item.totalRecords.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                            <StatusCell status={item.scheduleStatus} type="schedule" />
                        </TableCell>
                        <TableCell>
                            <StatusCell status={item.fileStatus} type="file" />
                        </TableCell>
                        <TableCell>
                             /* ... Edit/Delete Actions ... */
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
};