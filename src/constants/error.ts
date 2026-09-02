import {t} from "@/utils/i18nHelper";
import {LanguageFile} from "@/constants/language";

export const ERROR_CONSTANTS = {
    INVALID_CODE: () => t(LanguageFile.ERROR, "invalidCode"),
    SERVER_ERROR: () => t(LanguageFile.ERROR, "serverError"),
    LOAD_FAILED: () => t(LanguageFile.ERROR, "loadFailed"),
    LIMIT_SEND_EMAIL: () => t(LanguageFile.ERROR, "limitSendEmail"),
    EMAIL_NOT_EXIST: () => t(LanguageFile.ERROR, "emailNotExist"),
    CHANGE_PASSWORD_FAILED: () => t(LanguageFile.ERROR, "changePasswordFailed"),
};
