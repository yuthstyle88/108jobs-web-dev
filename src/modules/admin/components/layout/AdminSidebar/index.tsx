"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTranslation} from "react-i18next";

import {
    Users,
    Plus,
    Minus,
    LayoutDashboard,
    Handbag, CreditCard, ChartColumnStacked, Image as ImageIcon, Motorbike
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/Sidebar";
import Image from "next/image";
import {AssetIcon} from "@/constants/icons";
import {cn} from "@/lib/utils";
import {useSiteStore} from "@/store/useSiteStore";

const navigationItems = [
    {key: "dashboard", url: "/admin/dashboard", icon: LayoutDashboard},
    {key: "manageUsers", url: "/admin/manage-users", icon: Users},
    {key: "bankAccounts", url: "/admin/bank-accounts", icon: CreditCard},
    {key: "topupCoins", url: "/admin/topup-coins", icon: Plus},
    {key: "withdrawCoins", url: "/admin/withdraw-coins", icon: Minus},
    {key: "manageJobBoard", url: "/admin/manage-job-board", icon: Handbag},
    {key: "manageCategory", url: "/admin/manage-category", icon: ChartColumnStacked},
    {key: "managePicture", url: "/admin/manage-picture", icon: ImageIcon},
    {key: "manageRiders", url: "/admin/manage-riders", icon: Motorbike},
];

export function AdminSidebar() {
    const {t} = useTranslation();
    const {state} = useSidebar();
    const {siteView} = useSiteStore();
    const collapsed = state === "collapsed";
    const pathname = usePathname();
    const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");
    const logoUrl = siteView?.localSite?.icon || AssetIcon.logo.src;
    return (
        <Sidebar collapsible="icon">
            <SidebarContent className="bg-card">
                <div className="p-6 border-b border-border bg-primary">
                    <div className="flex items-center gap-3">
                        {!collapsed && (
                            <div className="text-primary">
                                <Link prefetch href="/admin/dashboard" className="shrink-0 block">
                                    <Image
                                        src={logoUrl}
                                        alt="Site logo"
                                        width={181}
                                        height={62}
                                        className="w-auto h-12 object-contain transition-all hover:opacity-90"
                                        priority
                                    />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <SidebarGroup className="px-4">
                    <SidebarGroupContent>
                        <nav aria-label={t("admin.layout.sidebar.navLabel")}>
                            <SidebarMenu className="space-y-1">
                                {navigationItems.map((item) => {
                                    const isActive = pathWithoutLocale === item.url;
                                    const title = t(`admin.layout.sidebar.nav.${item.key}.title`);
                                    const description = t(`admin.layout.sidebar.nav.${item.key}.description`);

                                    return (
                                        <SidebarMenuItem key={item.key}>
                                            <SidebarMenuButton asChild>
                                                <Link
                                                    href={item.url}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg transition-all group",
                                                        // Active state
                                                        isActive
                                                            ? "bg-primary text-white shadow-md"
                                                            : "hover:bg-muted/80",
                                                        // Collapsed: make button square + center icon
                                                        collapsed && "justify-center p-0 size-12",
                                                        // Expanded: normal padding
                                                        !collapsed && "px-3 py-2.5"
                                                    )}
                                                >
                                                    <item.icon
                                                        className={cn(
                                                            "w-5 h-5",
                                                            collapsed ? "w-10 h-10" : "",
                                                            isActive
                                                                ? "text-white"
                                                                : "text-muted-foreground group-hover:text-card-foreground"
                                                        )}
                                                    />
                                                    {!collapsed && (
                                                        <div className="flex-1 min-w-0">
                                                            <div className={cn("font-medium text-sm truncate", isActive ? "text-white" : "text-card-foreground")}>{title}</div>
                                                            <div
                                                                className={cn(
                                                                    "text-xs truncate",
                                                                    isActive ? "text-white/80" : "text-muted-foreground"
                                                                )}
                                                            >
                                                                {description}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </nav>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}