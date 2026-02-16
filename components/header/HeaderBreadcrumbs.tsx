"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs";

const SEGMENT_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    campaigns: "Campaigns",
    components: "Components",
    customers: "Customers",
    templates: "Templates",
    users: "Users",
};

const DYNAMIC_SEGMENT_CONFIGS = {
    campaigns: {
        endpoint: (id: string) => `/api/campaigns/${id}`,
        extractLabel: (payload: any) => payload?.name as string | undefined,
    },
    components: {
        endpoint: (id: string) => `/api/components/${id}`,
        extractLabel: (payload: any) => payload?.name as string | undefined,
    },
    customers: {
        endpoint: (id: string) => `/api/customer-list/${id}`,
        extractLabel: (payload: any) => payload?.contactList?.name as string | undefined,
    },
    templates: {
        endpoint: (id: string) => `/api/templates/${id}`,
        extractLabel: (payload: any) => payload?.title as string | undefined,
    },
} as const;

type DynamicSegmentKey = keyof typeof DYNAMIC_SEGMENT_CONFIGS;

type FetchTarget = {
    key: string;
    parent: DynamicSegmentKey;
    id: string;
};

type BreadcrumbNode = {
    key: string;
    label: string;
    href: string;
};

const formatSegmentLabel = (value: string) => {
    try {
        const decoded = decodeURIComponent(value);
        const normalized = decoded.replace(/[-_]+/g, " ").trim();
        if (!normalized) return decoded;
        return normalized
            .split(" ")
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    } catch {
        return value;
    }
};

const HeaderBreadcrumbs = () => {
    const pathname = usePathname() || "/";
    const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>({});

    const pathSegments = useMemo(() => {
        if (!pathname || pathname === "/") return [];
        return pathname.split("/").filter(Boolean);
    }, [pathname]);

    const fetchTargets = useMemo<FetchTarget[]>(() => {
        const targets: FetchTarget[] = [];
        pathSegments.forEach((segment, index) => {
            if (index === 0) return;
            const parent = pathSegments[index - 1] as DynamicSegmentKey | undefined;
            if (!parent) return;
            if (!(parent in DYNAMIC_SEGMENT_CONFIGS)) return;
            const key = `${parent}:${segment}`;
            targets.push({ key, parent, id: segment });
        });
        return targets;
    }, [pathSegments]);

    const pendingTargets = useMemo(
        () => fetchTargets.filter((target) => !dynamicLabels[target.key]),
        [fetchTargets, dynamicLabels],
    );

    // Fetch entity display names so nested breadcrumbs show meaningful labels.
    useEffect(() => {
        if (!pendingTargets.length) return;
        let cancelled = false;

        const load = async () => {
            const entries = await Promise.all(
                pendingTargets.map(async (target) => {
                    const config = DYNAMIC_SEGMENT_CONFIGS[target.parent];
                    if (!config) return null;
                    try {
                        const response = await fetch(config.endpoint(target.id), {
                            credentials: "include",
                        });
                        if (!response.ok) throw new Error("Request failed");
                        const payload = await response.json();
                        const label = config.extractLabel(payload);
                        return {
                            key: target.key,
                            label: label?.trim() || formatSegmentLabel(target.id),
                        };
                    } catch {
                        return {
                            key: target.key,
                            label: formatSegmentLabel(target.id),
                        };
                    }
                }),
            );

            if (cancelled) return;
            setDynamicLabels((prev) => {
                const next = { ...prev };
                entries.forEach((entry) => {
                    if (!entry) return;
                    next[entry.key] = entry.label;
                });
                return next;
            });
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [pendingTargets]);

    const breadcrumbNodes = useMemo<BreadcrumbNode[]>(() => {
        if (!pathSegments.length) {
            return [];
        }

        const nodes: BreadcrumbNode[] = [];
        let cumulativePath = "";

        pathSegments.forEach((segment, index) => {
            cumulativePath += `/${segment}`;
            const parent = index > 0 ? (pathSegments[index - 1] as DynamicSegmentKey | undefined) : undefined;
            const dynamicKey = parent && parent in DYNAMIC_SEGMENT_CONFIGS ? `${parent}:${segment}` : undefined;
            const label =
                (dynamicKey && dynamicLabels[dynamicKey]) ||
                SEGMENT_LABELS[segment] ||
                formatSegmentLabel(segment);

            nodes.push({
                key: `${segment}-${index}`,
                label,
                href: cumulativePath,
            });
        });

        return nodes;
    }, [pathSegments, dynamicLabels]);

    const crumbCount = breadcrumbNodes.length;

    if (!crumbCount) {
        return null;
    }

    return (
        <Breadcrumbs
            aria-label="Current location"
            className="max-w-full flex-1 truncate"
            itemClasses={{
                separator: "text-default-400",
            }}
        >
            {breadcrumbNodes.map((node, index) => {
                const isCurrent = index === crumbCount - 1;
                const colorClass = isCurrent ? "text-secondary" : "text-default-600";
                return (
                    <BreadcrumbItem
                        key={node.key}
                        href={isCurrent ? undefined : node.href}
                        isCurrent={isCurrent}
                        className={`text-small truncate max-w-[12rem] ${colorClass}`}
                    >
                        {node.label}
                    </BreadcrumbItem>
                );
            })}
        </Breadcrumbs>
    );
};

export default HeaderBreadcrumbs;
