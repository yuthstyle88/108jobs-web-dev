"use client";
import {faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {UseFormRegisterReturn} from "react-hook-form";

type InputProps = {
    tag?: "input" | "textarea"; // Added to support textarea
    type?: string;
    label?: string;
    name: string;
    register?: UseFormRegisterReturn;
    error?: string;
    showPassword?: boolean;
    autoComplete?: string;
    toggleShowPassword?: () => void;
    placeholder?: string;
    readonly?: boolean;
    required?: boolean;
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    rows?: number; // For textarea
    prefix?: string; // For username prefix
};

export const CustomInput = ({
                                tag = "input",
                                type = "text",
                                label,
                                name,
                                register,
                                error,
                                showPassword,
                                autoComplete,
                                toggleShowPassword,
                                placeholder,
                                readonly = false,
                                required = false,
                                value,
                                onChange,
                                rows,
                                prefix
                            }: InputProps) => (
    <div className="mb-4">
        {label && (
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
        )}
        <div className="relative flex items-center">
            {prefix && (
                <span className="text-gray-700 mr-2 flex-shrink-0 text-xs sm:text-sm leading-8" aria-hidden="true">
                    {prefix}
                </span>
            )}
            {tag === "input" ? (
                <input
                    id={name}
                    {...(register ?? {
                        name,
                        value,
                        onChange,
                    })}
                    className={`text-[#1a1a1a] w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                        error
                            ? "border-red-500 focus:ring-red-500 focus:shadow-input-shadow"
                            : "border-gray-300 focus:ring-blue-500"
                    }`}
                    type={toggleShowPassword ? (showPassword ? "text" : "password") : type}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    readOnly={readonly}
                    aria-describedby={error ? `${name}-error` : undefined}
                />
            ) : (
                <textarea
                    id={name}
                    {...(register ?? {
                        name,
                        value,
                        onChange,
                    })}
                    className={`text-[#1a1a1a] w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                        error
                            ? "border-red-500 focus:ring-red-500 focus:shadow-input-shadow"
                            : "border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder={placeholder}
                    readOnly={readonly}
                    rows={rows || 3}
                    aria-describedby={error ? `${name}-error` : undefined}
                />
            )}
            {toggleShowPassword && (
                <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer p-1 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    <FontAwesomeIcon
                        icon={showPassword ? faEyeSlash : faEye}
                        className="text-text-secondary"
                    />
                </button>
            )}
        </div>
        {error && (
            <p id={`${name}-error`} className="text-red-500 font-sans text-[13px] mt-1">
                {error}
            </p>
        )}
    </div>
);