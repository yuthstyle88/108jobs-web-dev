import {useEffect} from "react";
import {User, Mail, Calendar, FileText, X} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/Avatar";
import {LocalUserView} from "@108-plaza/jh-client";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LocalUserView;
}

export function UserDetailModal({isOpen, onClose, user}: UserDetailModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const {person, localUser, banned} = user;

    const getTypeLabel = () => "User";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5"/>
                        <h2 className="text-xl font-semibold">User Details</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5 text-muted-foreground"/>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Profile Section */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                        <Avatar className="w-16 h-16 ring-4 ring-white/50 shadow-lg">
                            {person.avatar ? (
                                <AvatarImage src={person.avatar} alt={person.name}/>
                            ) : (
                                <AvatarFallback>{person.name.charAt(0).toUpperCase()}</AvatarFallback>
                            )}
                        </Avatar>

                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="text-xl font-semibold truncate">{person.name}</h3>
                                <span className="px-2 py-0.5 text-xs font-medium border rounded-full">
                  {getTypeLabel()}
                </span>
                                {banned && (
                                    <span
                                        className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    Banned
                  </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4"/>
                    {localUser.email}
                </span>
                                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4"/>
                                    {new Date(person.publishedAt).toLocaleDateString("en-US")}
                </span>
                            </div>
                        </div>
                    </div>

                    {/* Skills */}
                    {person.skills && person.skills.length > 0 && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Skills</p>
                            <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-1 text-xs bg-secondary/50 rounded-full">
                    {person.skills}
                  </span>
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground"/>
                        <span>
              <strong>{person.workSamples?.length ?? 0}</strong> document
                            {(person.workSamples?.length ?? 0) !== 1 ? "s" : ""} uploaded
            </span>
                    </div>


                </div>
            </div>
        </div>
    );
}
