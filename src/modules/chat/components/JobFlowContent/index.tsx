import React from "react";
import {ChatRoomView} from "108jobs-client";

interface JobFlowContentProps {
    renderFlowContent: () => React.ReactNode;
    setShowJobDetailModal: (show: boolean) => void;
    currentRoom: ChatRoomView;
}

// This used to open with its own "Job Flow" header bar -- redundant under the
// Orders tab, which already says as much, and it stacked a second blue bar
// directly beneath ChatSidebarTabs' own one. That header's only other job,
// the mobile drawer's close button, moved to ChatSidebarTabs (it sits next to
// the tabs now, so it stays reachable on the Media tab too, not just here).
export const JobFlowContent: React.FC<JobFlowContentProps> = ({
                                                                  renderFlowContent,
                                                                  setShowJobDetailModal,
                                                                  currentRoom,
                                                              }) => {
    return (
        <>
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto border-b border-gray-200">
                {renderFlowContent()}
            </div>
            <div className="p-3 sm:p-4 bg-white border-t border-gray-200">
                <div
                    className="flex items-center bg-white rounded-lg shadow-sm p-2 sm:p-3 hover:shadow-md transition-all duration-200 hover:transform hover:scale-105 cursor-pointer"
                    aria-label="Job details"
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowJobDetailModal(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowJobDetailModal(true);
                        }
                    }}
                >
                    <div className="flex-1">
                        <h3 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 line-clamp-1">
                            {currentRoom?.post?.name
                                ? currentRoom.post.name.length > 40
                                    ? `${currentRoom.post.name.slice(0, 40)}...`
                                    : currentRoom.post.name
                                : "No Job Title"}
                        </h3>
                        <p className="text-[0.65rem] sm:text-xs md:text-sm text-gray-600 line-clamp-2">
                            {(currentRoom?.post as any)?.body
                                ? (currentRoom.post as any).body.length > 40
                                    ? `${(currentRoom.post as any).body.slice(0, 40)}...`
                                    : (currentRoom.post as any).body
                                : "No description available"}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};