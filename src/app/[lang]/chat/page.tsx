"use client";

import {useTranslation} from "react-i18next";

const Chat = () => {
    const {t} = useTranslation();

    return (
        <div className="relative h-full w-full bg-white">
            <div className="hidden h-full items-center justify-center p-4 text-gray-500 md:flex">
                {t("profileChat.selectConversation")}
            </div>
        </div>
    );
};

export default Chat;
