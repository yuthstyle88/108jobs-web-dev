"use client";
import {useState, useCallback} from "react";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {isFailed} from "@/services/HttpService";
import {Card} from "@/components/ui/Card";
import {Button} from "@/components/ui/Button";
import {Badge} from "@/components/ui/Badge";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {Ban, User, Eye, RotateCcw} from "lucide-react";
import {UserDetailModal} from "@/modules/admin/components/Modal/UserDetailModal";
import {toast} from "sonner";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {PaginationControls} from "@/components/PaginationControls";
import {BanPerson, LocalUserView, Person} from "108jobs-client";
import {BanConfirmationModal} from "@/modules/admin/components/Modal/BanConfirmationModal";
import {useTranslation} from "react-i18next";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";

const ManageUsers = () => {
    const {t} = useTranslation();

    const [filters, setFilters] = useState<{ limit: number; bannedOnly: boolean }>({
        limit: 10,
        bannedOnly: false,
    });

    const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);
    const [isGoingBack, setIsGoingBack] = useState(false);

    const {data, isLoading, isMutating, state, execute: refetch} = useHttpGet("listUsers", {
        ...filters,
        pageCursor: currentCursor,
        pageBack: isGoingBack,
    });

    const showLoading = isLoading || isMutating;
    const isFetchFailed = isFailed(state);

    const {execute: executeBan, isMutating: isBanning} = useHttpPost("banPerson");

    const users: LocalUserView[] = data?.users ?? [];
    const hasNextPage = !!data?.nextPage;
    const hasPreviousPage = cursorHistory.length > 0;

    const [selectedUser, setSelectedUser] = useState<LocalUserView | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [banTarget, setBanTarget] = useState<Person | null>(null);
    const [banReason, setBanReason] = useState("");

    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters((prev) => ({...prev, [key]: value}));
        setCurrentCursor(undefined);
        setCursorHistory([]);
        setIsGoingBack(false);
    };

    const handleNextPage = useCallback(() => {
        if (data?.nextPage) {
            setCursorHistory((prev) => [...prev, currentCursor || ""]);
            setCurrentCursor(data.nextPage);
            setIsGoingBack(false);
        }
    }, [data?.nextPage, currentCursor]);

    const handlePrevPage = useCallback(() => {
        if (cursorHistory.length > 0) {
            const prevCursor = cursorHistory[cursorHistory.length - 1];
            setCursorHistory((prev) => prev.slice(0, -1));
            setCurrentCursor(prevCursor || undefined);
            setIsGoingBack(true);
        }
    }, [cursorHistory]);

    const openBanModal = (person: Person) => {
        setBanTarget(person);
        setBanReason("");
    };

    const closeBanModal = () => {
        setBanTarget(null);
        setBanReason("");
    };

    const confirmBan = async () => {
        if (!banTarget) return;

        const payload: BanPerson = {
            personId: banTarget.id,
            ban: true,
            reason: banReason || undefined,
        };

        try {
            await executeBan(payload);
            toast.success(
                banReason
                    ? t("manageUsers.banConfirmationModal.successWithReason", {reason: banReason})
                    : `${t("manageUsers.bannedSuccess")} ${banTarget.name}`
            );
            refetch(); // Refresh user list
        } catch (error: any) {
            toast.error(error.message || t("common.errorOccurred"));
        } finally {
            closeBanModal();
        }
    };

    const handleUnban = async (person: Person) => {
        const payload: BanPerson = {
            personId: person.id,
            ban: false,
        };

        try {
            await executeBan(payload);
            toast.success(t("manageUsers.unbannedSuccess", {name: person.name}));
            refetch();
        } catch (error: any) {
            toast.error(error.message || t("common.errorOccurred"));
        }
    };
    const openDetailModal = (user: LocalUserView) => {
        setSelectedUser(user);
        setIsDetailModalOpen(true);
    };

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto text-gray-600 p-6 space-y-8">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-light tracking-tight">{t("manageUsers.title")}</h1>
                        <p className="text-sm text-muted-foreground mt-1">{t("manageUsers.description")}</p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant={filters.bannedOnly ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleFilterChange("bannedOnly", !filters.bannedOnly)}
                            className="text-xs"
                        >
                            <Ban className="w-3.5 h-3.5 mr-1"/>
                            {filters.bannedOnly ? t("manageUsers.bannedOnly") : t("manageUsers.allUsers")}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentCursor(undefined);
                                setCursorHistory([]);
                                refetch();
                            }}
                        >
                            <RotateCcw className="w-3.5 h-3.5"/>
                        </Button>
                    </div>
                </header>

                {/* User List */}
                <div className="space-y-3">
                    {showLoading ? (
                        <div className="flex justify-center py-16">
                            <div
                                className="w-8 h-8 border-2 border-t-transparent border-foreground/30 rounded-full animate-spin"></div>
                        </div>
                    ) : isFetchFailed ? (
                        <Card className="border-dashed p-12 text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">{t("manageUsers.fetchError")}</p>
                        </Card>
                    ) : users.length === 0 ? (
                        <Card className="border-dashed p-12 text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">{t("manageUsers.noUsersFound")}</p>
                        </Card>
                    ) : (
                        users.map((userView) => {
                            const {person, localUser} = userView;
                            const banned = userView?.banned ?? false;

                            return (
                                <Card
                                    key={localUser.id}
                                    className="p-5 hover:shadow-sm transition-shadow duration-200 border"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        {/* User Info */}
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <Avatar className="h-11 w-11 shrink-0">
                                                <AvatarImage src={person.avatar}/>
                                                <AvatarFallback className="text-xs font-medium">
                                                    {person.name[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-medium truncate">{person.displayName}</h3>
                                                    {banned && (
                                                        <Badge variant="destructive"
                                                               className="text-xs h-5 bg-red-600 text-white">
                                                            <Ban className="w-3 h-3 mr-1"/>
                                                            {t("manageUsers.bannedBadge")}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{localUser.email || "—"}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Joined {new Date(person.publishedAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openDetailModal(userView)}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                <Eye className="w-4 h-4"/>
                                            </Button>

                                            {banned ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUnban(person)}
                                                    className="text-xs font-medium border-green-600 text-green-600 hover:bg-green-50"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1"/>
                                                    {isBanning ? t("common.processing") : t("manageUsers.unban")}
                                                </Button>
                                            ) : (
                                                userView.localUser.admin ? null : (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => openBanModal(person)}
                                                        className="py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                                    >
                                                        <Ban className="w-3.5 h-3.5 mr-1"/>
                                                        {t("manageUsers.ban")}
                                                    </Button>
                                                )
                                            )}

                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                <PaginationControls
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    onPrevious={handlePrevPage}
                    onNext={handleNextPage}
                    isLoading={showLoading}
                />

                {/* Detail Modal */}
                {selectedUser && (
                    <UserDetailModal
                        isOpen={isDetailModalOpen}
                        onClose={() => {
                            setIsDetailModalOpen(false);
                            setSelectedUser(null);
                        }}
                        user={selectedUser}
                    />
                )}

                <BanConfirmationModal
                    isOpen={!!banTarget}
                    user={{
                        id: banTarget?.id ?? 0,
                        name: banTarget?.name ?? "",
                    }}
                    reason={banReason}
                    onReasonChange={setBanReason}
                    onConfirm={confirmBan}
                    onCancel={closeBanModal}
                    isLoading={isBanning}
                />
            </div>
        </AdminLayout>
    );
};

export default ManageUsers;