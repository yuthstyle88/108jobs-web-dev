import {useTranslation} from 'react-i18next';
import Link from "next/link";

export const RoomNotFound = () => {
    const {t, i18n} = useTranslation();
    return (
        <div className="flex items-center justify-center w-full h-[calc(100vh-80px)]">
            <div className="text-center p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('roomNotFound.title')}</h2>
                <p className="text-gray-600 mb-4">{t('roomNotFound.description')}</p>
                <Link href={`/${i18n.language}/chat`}
                      className="inline-block bg-primary text-white px-4 py-2 rounded-md hover:bg-[#063a68] transition-colors">{t('roomNotFound.goBack')}</Link>
            </div>
        </div>
    );
};