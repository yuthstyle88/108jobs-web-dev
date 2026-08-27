"use client";
import {AuthFormContainer} from "@/components/Authentication/AuthFormContainer";
import {RegisterForm} from "@/components/Authentication/RegisterForm";
import {PhoneOtpAuthForm} from "@/components/Authentication/PhoneOtpAuthForm";
import {AuthenticateIcon} from "@/constants/icons";
import {CategoriesImage} from "@/constants/images";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {useTranslation} from "react-i18next";

export default function RegisterPage() {
    const {t} = useTranslation();
    const router = useRouter();
    const [authMode, setAuthMode] = useState<"password" | "otp">("password");

    return (
        <div
            className="min-h-screen bg-[#E3EDFD] grid 2xl:grid-cols-[1fr_1240px_1fr] lg:grid-cols-[1fr_984px_1fr] md:grid-cols-[1fr_768px_1fr] grid-cols-[12px_minmax(0,auto)12px]">
            <div
                className="flex justify-center items-center lg:flex-row lg:gap-[3rem] lg:justify-between col-start-2 col-end-3">
                <div className="hidden lg:flex m-auto flex-col gap-[5rem]">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-row items-center">
                            <h2 className="text-[2.5rem] text-[hsl(215,15%,20%,0.95)]">
                                {t("authen.titleHireThrough")}
                            </h2>
                            <Image src={CategoriesImage.logodefault} alt="logo"/>
                        </div>
                        <div className="flex gap-2 flex-row items-center">
                            <h2 className="text-[2.5rem] text-[hsl(215,15%,20%,0.95)]">
                                {t("authen.subtitleSafeMoney")}
                            </h2>
                        </div>
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage1}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelGuaranteedPay")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage2}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelProfessionalLicense")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage3}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelRefundPolicy")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage4}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelHiringAdvice")}
              </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Image
                                src={AuthenticateIcon.advantage5}
                                alt="advantage"
                                className="h-[48px] w-[48px]"
                            />
                            <span
                                className="font-sans text-[20px] font-medium leading-[23px] text-[rgba(43,50,59,0.95)]">
                {t("authen.labelFreelancerVerified")}
              </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 justify-center items-center py-[4rem] max-w-[500px] w-full h-full ">
                    <Image
                        className="lg:hidden block"
                        src={CategoriesImage.logodefault}
                        alt="logo"
                    />
                    <AuthFormContainer
                        title={t("authen.titleCreateAccount")}
                        onBack={() => router.push("/login")}
                    >
                        {authMode === "password" ? (
                            <RegisterForm onSwitchToOtp={() => setAuthMode("otp")}/>
                        ) : (
                            <PhoneOtpAuthForm mode="register" onSwitchToPassword={() => setAuthMode("password")}/>
                        )}
                    </AuthFormContainer>
                </div>
            </div>
        </div>
    );
}
