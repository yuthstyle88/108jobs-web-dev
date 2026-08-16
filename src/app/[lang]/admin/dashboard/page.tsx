"use client";

import {StatsCard} from "@/components/ui/StatsCard";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import {Users, MessageSquare, Globe, Activity, Shield, CheckCircle, AlertTriangle, Settings} from "lucide-react";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {useSiteStore} from "@/store/useSiteStore";
import {format} from "date-fns";
import {useTranslation} from "react-i18next";

const DashboardPage = () => {
    const {t} = useTranslation();
    const {siteRes} = useSiteStore();

    const localSite = siteRes?.siteView?.localSite;
    const rateLimit = siteRes?.siteView?.localSiteRateLimit;
    const admins = siteRes?.admins || [];
    const version = siteRes?.version;

    const siteName = localSite?.name ?? "108Jobs";

    const stats = [
        {
            title: t("dashboard.stats.totalUsers"),
            value: localSite?.users?.toLocaleString() ?? "0",
            icon: Users,
            description: t("dashboard.stats.descriptionUsers"),
        },
        {
            title: t("dashboard.stats.totalPosts"),
            value: localSite?.posts?.toLocaleString() ?? "0",
            icon: MessageSquare,
            description: t("dashboard.stats.descriptionPosts"),
        },
        {
            title: t("dashboard.stats.totalProposals"),
            value: localSite?.proposals?.toLocaleString() ?? "0",
            icon: MessageSquare,
            description: t("dashboard.stats.descriptionProposals"),
        },
    ];

    const activityMetrics = [
        {label: t("dashboard.activity.today"), value: localSite?.usersActiveDay ?? 0},
        {label: t("dashboard.activity.week"), value: localSite?.usersActiveWeek ?? 0},
        {label: t("dashboard.activity.month"), value: localSite?.usersActiveMonth ?? 0},
        {label: t("dashboard.activity.sixMonths"), value: localSite?.usersActiveHalfYear ?? 0},
    ];

    return (
        <AdminLayout>
            <div className="space-y-6 text-gray-600">
                <div>
                    <h1 className="text-3xl font-bold">
                        {t("dashboard.title")}
                    </h1>
                    <p className="mt-2">
                        {t("dashboard.description", {siteName})}
                    </p>
                </div>

                {/* Site Info Bar */}
                <Card className="bg-muted/50 border-border/50">
                    <CardContent className="flex flex-wrap items-center gap-6 py-3 text-sm">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4"/>
                            <span
                                className="font-medium tex">{t("dashboard.siteInfo.instance")}:</span> {localSite?.name ?? "108jobs"}
                        </div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4"/>
                            <span
                                className="font-medium">{t("dashboard.siteInfo.version")}:</span> {version ?? "N/A"}
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4"/>
                            <span className="font-medium">{t("dashboard.siteInfo.registration")}:</span>{" "}
                            <span
                                className={localSite?.registrationMode === "Open" ? "text-green-700" : "text-red-800"}
                            >
                {localSite?.registrationMode ?? t("common.unknown")}
              </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4"/>
                            <span className="font-medium">{t("dashboard.siteInfo.emailVerification")}:</span>{" "}
                            {localSite?.requireEmailVerification
                                ? t("dashboard.siteInfo.required")
                                : t("dashboard.siteInfo.optional")}
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4"/>
                            <span className="font-medium">{t("dashboard.siteInfo.captcha")}:</span>{" "}
                            {localSite?.captchaEnabled
                                ? t("dashboard.siteInfo.enabled", {difficulty: localSite.captchaDifficulty ?? "easy"})
                                : t("dashboard.siteInfo.disabled")}
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat, index) => (
                        <StatsCard key={index} {...stat} />
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* User Activity */}
                    <Card className="bg-card border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5"/>
                                {t("dashboard.activity.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {activityMetrics.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{item.label}</p>
                                        <p className="text-sm">
                                            {item.value} {item.value === 1 ? t("dashboard.activity.user") : t("dashboard.activity.users")}
                                        </p>
                                    </div>
                                    <div
                                        className={`w-2 h-2 rounded-full ${item.value > 0 ? "bg-success" : "bg-muted"}`}/>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Rate Limits & Admins */}
                    <Card className="bg-card border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5"/>
                                {t("dashboard.limits.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{t("dashboard.limits.postRateLimit")}</p>
                                        <p className="text-xs">
                                            {rateLimit?.postMaxRequests ?? 6} {t("dashboard.limits.perMinute", {
                                            minutes: (rateLimit?.postIntervalSeconds ?? 600) / 60
                                        })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{t("dashboard.limits.registerRateLimit")}</p>
                                        <p className="text-xs">
                                            {rateLimit?.registerMaxRequests ?? 10} {t("dashboard.limits.perHour")}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{t("dashboard.limits.admins")}</p>
                                        <p className="text-xs">
                                            {admins.length} {admins.length === 1 ? t("dashboard.limits.activeAdmin") : t("dashboard.limits.activeAdmins")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent System Events */}
                <Card className="bg-card border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-success"/>
                            {t("dashboard.events.title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-2 h-2 bg-blue rounded-full"></div>
                                <div className="flex-1">
                                    <p className="font-medium">
                                        {t("dashboard.events.adminActive", {name: admins[0]?.person?.name ?? "admin"})}
                                    </p>
                                    <p className="text-xs">
                                        {t("dashboard.events.instanceId", {id: siteRes?.siteView?.instance?.id ?? "1"})}
                                    </p>
                                </div>
                            </div>

                            {localSite?.posts !== undefined && localSite.posts > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                    <div className="w-2 h-2 bg-blue rounded-full"></div>
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            {t("dashboard.events.postsPublished", {count: Number(localSite.posts)})}
                                        </p>
                                        <p className="text-xs">
                                            {t("dashboard.events.sinceLaunch", {
                                                date: localSite?.publishedAt ? format(new Date(localSite.publishedAt), "PPP") : t("common.launch")
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
};

export default DashboardPage;