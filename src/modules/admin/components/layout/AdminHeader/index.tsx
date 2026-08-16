import {Button} from "@/components/ui/Button";
import {SidebarTrigger} from "@/components/ui/Sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {ProfileImage} from "@/constants/images";
import React, {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {UserService} from "@/services";
import {useUserStore} from "@/store/useUserStore";

export function AdminHeader() {
    const logout = useCallback(() => UserService.Instance.logout(), []);
    const {t} = useTranslation();
    const {userInfo} = useUserStore();
    const person = userInfo?.localUserView.person;
    const email = userInfo?.localUserView.localUser.email;
    const displayName = person?.displayName || person?.name || "";
    const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "AD";

    return (
        <header
            className="h-16 border-b border-border bg-primary text-white flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="text-white/80 hover:text-white"/>
            </div>

            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 px-3 gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={person?.avatar || ProfileImage.avatar.src} alt={displayName || t("admin.layout.header.defaultAdminLabel")}/>
                                <AvatarFallback className="bg-black text-white">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start text-left">
                                <span className="text-sm font-medium">{displayName}</span>
                                <span className="text-xs text-white/80">{email}</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{displayName}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem className="text-destructive" onSelect={logout}>
                            {t("admin.layout.header.logout")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
