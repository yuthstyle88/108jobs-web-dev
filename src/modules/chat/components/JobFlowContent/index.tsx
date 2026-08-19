import React from "react";

interface JobFlowContentProps {
    renderFlowContent: () => React.ReactNode;
}

/** The Orders tab owns workflow actions only; job details no longer open here. */
export const JobFlowContent: React.FC<JobFlowContentProps> = ({renderFlowContent}) => {
    return (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {renderFlowContent()}
        </div>
    );
};
