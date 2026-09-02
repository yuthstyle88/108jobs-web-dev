"use client";
import {AssetIcon} from "@/constants/icons";
import Image from "next/image";
import Link from "next/link";
import {useState} from "react";
import {useTranslation} from "react-i18next";
import {getAppName} from "@/utils/appConfig";

const PrivacyPolicy = () => {
    const {t} = useTranslation();
    const [openSection, setOpenSection] = useState<string | null>(null);

    const sections = [
        {id: "definitions", title: t("termsEmployer.privacyPage.definitionsTitle"), key: "definitions"},
        {id: "processing", title: t("termsEmployer.privacyPage.processingTitle"), key: "processing"},
        {id: "collection", title: t("termsEmployer.privacyPage.collectionTitle"), key: "collection"},
        {
            id: "personal-data-types",
            title: t("termsEmployer.privacyPage.personalDataTypesTitle"),
            key: "personalDataTypes"
        },
        {id: "purposes", title: t("termsEmployer.privacyPage.purposesTitle"), key: "purposes"},
        {id: "lawful-bases", title: t("termsEmployer.privacyPage.lawfulBasesTitle"), key: "lawfulBases"},
        {id: "consent", title: t("termsEmployer.privacyPage.consentTitle"), key: "consent"},
        {id: "marketing", title: t("termsEmployer.privacyPage.marketingTitle"), key: "marketing"},
        {id: "enforcement", title: t("termsEmployer.privacyPage.enforcementTitle"), key: "enforcement"},
        {
            id: "notice-at-collection",
            title: t("termsEmployer.privacyPage.noticeAtCollectionTitle"),
            key: "noticeAtCollection"
        },
        {id: "use", title: t("termsEmployer.privacyPage.useTitle"), key: "use"},
        {id: "disclosure", title: t("termsEmployer.privacyPage.disclosureTitle"), key: "disclosure"},
        {id: "retention", title: t("termsEmployer.privacyPage.retentionTitle"), key: "retention"},
        {id: "rights", title: t("termsEmployer.privacyPage.rightsTitle"), key: "rights"},
        {id: "cookies", title: t("termsEmployer.privacyPage.cookiesTitle"), key: "cookies"},
        {id: "security", title: t("termsEmployer.privacyPage.securityTitle"), key: "security"},
        {id: "breach", title: t("termsEmployer.privacyPage.breachTitle"), key: "breach"},
        {id: "policy-change", title: t("termsEmployer.privacyPage.policyChangeTitle"), key: "policyChange"},
        {id: "other-sites", title: t("termsEmployer.privacyPage.otherSitesTitle"), key: "otherSites"},
        {id: "contact", title: t("termsEmployer.privacyPage.contactTitle"), key: "contact"},
    ];

    const toggleSection = (id: string) => {
        setOpenSection(openSection === id ? null : id);
    };

    return (
        <main className="bg-gray-50 min-h-screen">
            {/* Header Section */}
            <section className="relative bg-[#042A48] text-white py-16 overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <Image
                        src={AssetIcon.logoIcon}
                        alt="Background Logo"
                        layout="fill"
                        objectFit="cover"
                        className="object-right-bottom"
                    />
                </div>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("termsEmployer.privacyPolicyTitle")}</h1>
                    <p className="mt-4 text-gray-200 max-w-2xl mx-auto">{t("termsEmployer.privacyPage.introTop")}</p>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-12 sm:py-16 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar (Table of Contents) */}
                    <aside className="lg:w-64 flex-shrink-0 lg:sticky lg:top-20 hidden lg:block">
                        <div
                            className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-100/50">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h2>
                            <ul className="space-y-2">
                                {sections.map((section) => (
                                    <li key={section.id}>
                                        <a
                                            href={`#${section.id}`}
                                            className="text-sm text-gray-700 hover:text-blue-600 hover:underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            aria-label={`Jump to ${section.title}`}
                                        >
                                            {section.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>

                    {/* Mobile Dropdown Menu */}
                    <div className="lg:hidden mb-6">
                        <select
                            className="w-full p-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            onChange={(e) => {
                                if (e.target.value) {
                                    document.getElementById(e.target.value)?.scrollIntoView({behavior: "smooth"});
                                }
                            }}
                            aria-label="Select a section"
                        >
                            <option value="">Select a section</option>
                            {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    {section.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Content */}
                    <div className="flex-1 max-w-3xl">
                        <div className="text-center mb-12">
                            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t("termsEmployer.privacyPolicyTitle")}</h2>
                        </div>
                        <div className="space-y-6">
                            {sections.map((section) => (
                                <div
                                    key={section.id}
                                    id={section.id}
                                    className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-md border border-gray-100/50"
                                >
                                    <button
                                        className="w-full text-left text-lg font-semibold text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        onClick={() => toggleSection(section.id)}
                                        aria-expanded={openSection === section.id}
                                        aria-controls={`${section.id}-content`}
                                    >
                                        {section.title}
                                    </button>
                                    <div
                                        id={`${section.id}-content`}
                                        className={`space-y-4 text-gray-700 ${openSection === section.id || window.innerWidth >= 1024 ? "block" : "hidden"}`}
                                    >
                                        {section.key === "definitions" && (
                                            <ul className="list-disc pl-6 grid gap-2">
                                                {[
                                                    "law",
                                                    "company",
                                                    "policy",
                                                    "personalData",
                                                    "sensitivePersonalData",
                                                    "controller",
                                                    "processor",
                                                    "dataSubject",
                                                    "processing",
                                                    "appDefinition",
                                                ].map((key) => (
                                                    <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {section.key === "processing" && (
                                            <p className="leading-relaxed">{t("termsEmployer.privacyPage.processingIntro")}</p>
                                        )}
                                        {section.key === "collection" && (
                                            <>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.collectionIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {["signupByPhone", "signupByEmail", "signupByFacebook", "signupByGoogle"].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                                <p className="leading-relaxed">
                                                    {t("termsEmployer.privacyPage.otherCollectionIntro")}<br/>
                                                    {t("termsEmployer.privacyPage.fromOtherSourcesNoticeIntro")}<br/>
                                                    {t("termsEmployer.privacyPage.fromOtherSourcesNoticeWithin")}
                                                </p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {[
                                                        "fromOtherSourcesSteps_notify",
                                                        "fromOtherSourcesSteps_consentOrLawfulBasis",
                                                        "fromOtherSourcesSteps_newPurposeNotice",
                                                        "fromOtherSourcesSteps_legalOrContractualRequirementNotice",
                                                        "fromOtherSourcesSteps_categoriesAndRetention",
                                                        "fromOtherSourcesSteps_recipientsCategories",
                                                        "fromOtherSourcesSteps_companyContactInfo",
                                                        "fromOtherSourcesSteps_rightsNotice",
                                                    ].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {section.key === "personalDataTypes" && (
                                            <ul className="list-disc pl-6 grid gap-2">
                                                {[
                                                    "personalDataTypes_identity",
                                                    "personalDataTypes_contact",
                                                    "personalDataTypes_account",
                                                    "personalDataTypes_identificationDocs",
                                                    "personalDataTypes_transaction",
                                                    "personalDataTypes_technical",
                                                    "personalDataTypes_other",
                                                ].map((key) => (
                                                    <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {section.key === "purposes" && (
                                            <ul className="list-disc pl-6 grid gap-2">
                                                {[
                                                    "purposes_accountManagement",
                                                    "purposes_delivery",
                                                    "purposes_payment",
                                                    "purposes_afterSales",
                                                    "purposes_feedback",
                                                    "purposes_internalAdmin",
                                                    "purposes_termsCompliance",
                                                    "purposes_termsEnforcement",
                                                    "purposes_legalClaims",
                                                    "purposes_legalCompliance",
                                                    "purposes_marketing_anonymous",
                                                    "purposes_improvement_identifiable",
                                                ].map((key) => (
                                                    <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {section.key === "lawfulBases" && (
                                            <ul className="list-disc pl-6 grid gap-2">
                                                {[
                                                    "lawfulBases_historicalResearch",
                                                    "lawfulBases_vitalInterest",
                                                    "lawfulBases_contract",
                                                    "lawfulBases_publicTask",
                                                    "lawfulBases_legitimateInterest",
                                                    "lawfulBases_legalObligation",
                                                ].map((key) => (
                                                    <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {section.key === "consent" && (
                                            <>
                                                <p className="leading-relaxed">
                                                    {t("termsEmployer.privacyPage.consentIntro")}{" "}
                                                    <Link
                                                        prefetch={false}
                                                        className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                        href="/account-setting/manage"
                                                        aria-label={t("termsEmployer.privacyPage.consentLinkText")}
                                                    >
                                                        {t("termsEmployer.privacyPage.consentLinkText")}
                                                    </Link>{" "}
                                                    {t("termsEmployer.privacyPage.consentMoreChannels")}
                                                </p>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.minorsNoticeIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {["minorsRule1", "minorsRule2"].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.minorsDeleteNotice")}</p>
                                            </>
                                        )}
                                        {section.key === "marketing" && (
                                            <p className="leading-relaxed">
                                                {t("termsEmployer.privacyPage.marketingIntro")}<br/>
                                                {t("termsEmployer.privacyPage.marketingUnsubscribe")}
                                            </p>
                                        )}
                                        {section.key === "enforcement" && (
                                            <p className="leading-relaxed">{t("termsEmployer.privacyPage.enforcementIntro")}</p>
                                        )}
                                        {section.key === "noticeAtCollection" && (
                                            <>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.noticeAtCollectionIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                                        <li key={i}>{t(`termsEmployer.privacyPage.noticeAtCollection${i}`)}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {section.key === "use" && (
                                            <p className="leading-relaxed">{t("termsEmployer.privacyPage.useIntro")}</p>
                                        )}
                                        {section.key === "disclosure" && (
                                            <>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.disclosureIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {[
                                                        "disclosureList_consentWithNotice",
                                                        "disclosureList_legalCompliance",
                                                        "disclosureList_contractPerformanceOrPreContract",
                                                        "disclosureList_thirdPartyContractForBenefit",
                                                        "disclosureList_vitalInterestWhenCannotConsent",
                                                        "disclosureList_importantPublicInterest",
                                                    ].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.processorDutiesIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {["processorDuty1", "processorDuty2", "processorDuty3"].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.processorDutiesNote")}</p>
                                            </>
                                        )}
                                        {section.key === "retention" && (
                                            <p className="leading-relaxed">
                                                {t("termsEmployer.privacyPage.retentionIntro1", {app: getAppName()})}<br/>
                                                {t("termsEmployer.privacyPage.retentionIntro2", {app: getAppName()})}{" "}
                                                <Link
                                                    prefetch={false}
                                                    className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                    href="/content/support-center"
                                                    aria-label="Support Center"
                                                >
                                                    https://108jobs.com/content/support-center
                                                </Link>
                                            </p>
                                        )}
                                        {section.key === "rights" && (
                                            <>
                                                <p className="leading-relaxed">
                                                    {t("termsEmployer.privacyPage.rightsIntro1")}<br/>
                                                    {t("termsEmployer.privacyPage.rightsIntro2")}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {[
                                                        {
                                                            title: "rights_withdrawTitle",
                                                            desc: ["rights_withdrawDesc1", "rights_withdrawDesc2"],
                                                            sublist: [],
                                                        },
                                                        {
                                                            title: "rights_accessTitle",
                                                            desc: ["rights_accessDesc"],
                                                            sublist: []
                                                        },
                                                        {
                                                            title: "rights_portabilityTitle",
                                                            desc: ["rights_portabilityDesc"],
                                                            sublist: []
                                                        },
                                                        {
                                                            title: "rights_rectificationTitle",
                                                            desc: ["rights_rectificationDesc"],
                                                            sublist: []
                                                        },
                                                        {
                                                            title: "rights_objectTitle",
                                                            desc: ["rights_objectDesc"],
                                                            sublist: [
                                                                "rights_object_publicInterest",
                                                                "rights_object_officialAuthority",
                                                                "rights_object_directMarketing",
                                                                "rights_object_researchHistoryStats",
                                                            ],
                                                        },
                                                        {
                                                            title: "rights_erasureTitle",
                                                            desc: ["rights_erasureDesc"],
                                                            sublist: [
                                                                "rights_erasure_whenNoLongerNecessary",
                                                                "rights_erasure_noLegalAuthority",
                                                                "rights_erasure_afterWithdrawConsent",
                                                                "rights_erasure_afterObjectionHonored",
                                                            ],
                                                        },
                                                        {
                                                            title: "rights_restrictionTitle",
                                                            desc: ["rights_restrictionDesc"],
                                                            sublist: [
                                                                "rights_restriction_duringRectificationCheck",
                                                                "rights_restriction_duringObjectionCheck",
                                                                "rights_restriction_insteadOfDeletion",
                                                                "rights_restriction_legalClaimsRetention",
                                                            ],
                                                        },
                                                        {
                                                            title: "rights_complaintTitle",
                                                            desc: ["rights_complaintDesc1", "rights_complaintDesc2_start"],
                                                            sublist: [],
                                                            extra: (
                                                                <span>
                                  <Link
                                      prefetch={false}
                                      className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                      href="/content/support-center"
                                      aria-label="Support Center"
                                  >
                                    https://108jobs.com/content/support-center
                                  </Link>
                                  <br/>
                                                                    {t("termsEmployer.privacyPage.rights_complaintDesc2_end")}
                                </span>
                                                            ),
                                                        },
                                                    ].map((right, index) => (
                                                        <div key={index}
                                                             className="border border-gray-200 rounded-lg p-4">
                                                            <h4 className="font-semibold text-gray-900">{t(`termsEmployer.privacyPage.${right.title}`)}</h4>
                                                            {right.desc.map((desc, i) => (
                                                                <p key={i} className="mt-2 leading-relaxed">
                                                                    {t(`termsEmployer.privacyPage.${desc}`, {app: getAppName()})}
                                                                </p>
                                                            ))}
                                                            {right.sublist.length > 0 && (
                                                                <ul className="list-disc pl-6 mt-2 grid gap-2">
                                                                    {right.sublist.map((sub) => (
                                                                        <li key={sub}>{t(`termsEmployer.privacyPage.${sub}`)}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                            {right.extra}
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="mt-4 leading-relaxed">{t("termsEmployer.privacyPage.rightsTable_note")}</p>
                                                <div
                                                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                    {[
                                                        {
                                                            right: "rights_withdrawTitle",
                                                            selfService: true,
                                                            requestForm: false,
                                                            time: "7"
                                                        },
                                                        {
                                                            right: "rights_accessTitle",
                                                            selfService: true,
                                                            requestForm: false,
                                                            time: t("termsEmployer.privacyPage.rightsTable_immediately")
                                                        },
                                                        {
                                                            right: "rights_portabilityTitle",
                                                            selfService: false,
                                                            requestForm: true,
                                                            time: "30"
                                                        },
                                                        {
                                                            right: "rights_rectificationTitle",
                                                            selfService: true,
                                                            requestForm: false,
                                                            time: t("termsEmployer.privacyPage.rightsTable_immediately")
                                                        },
                                                        {
                                                            right: "rights_objectTitle",
                                                            selfService: false,
                                                            requestForm: true,
                                                            time: "30"
                                                        },
                                                        {
                                                            right: "rights_erasureTitle",
                                                            selfService: false,
                                                            requestForm: true,
                                                            time: "30"
                                                        },
                                                        {
                                                            right: "rights_restrictionTitle",
                                                            selfService: false,
                                                            requestForm: true,
                                                            time: "30"
                                                        },
                                                        {
                                                            right: "rights_complaintTitle",
                                                            selfService: true,
                                                            requestForm: false,
                                                            time: t("termsEmployer.privacyPage.rightsTable_immediately")
                                                        },
                                                    ].map((row, index) => (
                                                        <div key={index}
                                                             className="border border-gray-200 rounded-lg p-4">
                                                            <h4 className="font-semibold text-gray-900">{t(`termsEmployer.privacyPage.${row.right}`)}</h4>
                                                            <p className="mt-2">Self-Service: {row.selfService ? "✓" : "✗"}</p>
                                                            <p>Request Form: {row.requestForm ? "✓" : "✗"}</p>
                                                            <p>Time: {row.time} days</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="mt-4 leading-relaxed">{t("termsEmployer.privacyPage.rights_concludingNote")}</p>
                                            </>
                                        )}
                                        {section.key === "cookies" && (
                                            <p className="leading-relaxed">
                                                {t("termsEmployer.privacyPage.cookiesIntro")}{" "}
                                                <Link
                                                    prefetch={false}
                                                    className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                    href="/consent-management"
                                                    aria-label={t("termsEmployer.privacyPage.cookiesManageLinkText")}
                                                >
                                                    {t("termsEmployer.privacyPage.cookiesManageLinkText")}
                                                </Link>
                                                <br/>
                                                {t("termsEmployer.privacyPage.cookiesMoreInfo")}{" "}
                                                <a
                                                    className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                    href="https://108jobs.com/blog/cookie-policy/"
                                                    aria-label={t("termsEmployer.privacyPage.cookiesPolicyLinkText")}
                                                >
                                                    {t("termsEmployer.privacyPage.cookiesPolicyLinkText")}
                                                </a>
                                            </p>
                                        )}
                                        {section.key === "security" && (
                                            <>
                                                <p className="leading-relaxed">
                                                    {t("termsEmployer.privacyPage.securityIntro1")}<br/>
                                                    {t("termsEmployer.privacyPage.securityIntro2")}{" "}
                                                    <Link
                                                        prefetch={false}
                                                        className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                        href="/content/support-center"
                                                        aria-label={t("termsEmployer.privacyPage.securityReportLinkText")}
                                                    >
                                                        {t("termsEmployer.privacyPage.securityReportLinkText")}
                                                    </Link>
                                                    <br/>
                                                    {t("termsEmployer.privacyPage.securityDeletionIntro")}
                                                </p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {["securityDeletion1", "securityDeletion2", "securityDeletion3"].map((key) => (
                                                        <li key={key}>{t(`termsEmployer.privacyPage.${key}`)}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {section.key === "breach" && (
                                            <p className="leading-relaxed">{t("termsEmployer.privacyPage.breachIntro")}</p>
                                        )}
                                        {section.key === "policyChange" && (
                                            <p className="leading-relaxed">
                                                {t("termsEmployer.privacyPage.policyChangeIntro1")}<br/>
                                                {t("termsEmployer.privacyPage.policyChangeIntro2")}
                                            </p>
                                        )}
                                        {section.key === "otherSites" && (
                                            <p className="leading-relaxed">{t("termsEmployer.privacyPage.otherSitesIntro", {app: getAppName()})}</p>
                                        )}
                                        {section.key === "contact" && (
                                            <>
                                                <p className="leading-relaxed">{t("termsEmployer.privacyPage.contactIntro")}</p>
                                                <ul className="list-disc pl-6 grid gap-2">
                                                    {[
                                                        {
                                                            title: "contact_controllerTitle",
                                                            sublist: ["contact_companyName", "contact_address", "contact_supportCenterLabel"],
                                                        },
                                                        {
                                                            title: "contact_dpoTeamTitle",
                                                            sublist: ["contact_companyName", "contact_address", "contact_emailLabel"],
                                                        },
                                                    ].map((item, index) => (
                                                        <li key={index}>
                                                            {t(`termsEmployer.privacyPage.${item.title}`)}
                                                            <ul className="list-disc pl-6 mt-2">
                                                                {item.sublist.map((sub, i) => (
                                                                    <li key={i}>
                                                                        {sub === "contact_supportCenterLabel" ? (
                                                                            <>
                                                                                {t(`termsEmployer.privacyPage.${sub}`)}{" "}
                                                                                <Link
                                                                                    prefetch={false}
                                                                                    className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                                                    href="/content/support-center"
                                                                                    aria-label="Support Center"
                                                                                >
                                                                                    https://108jobs.com/content/support-center
                                                                                </Link>
                                                                            </>
                                                                        ) : sub === "contact_emailLabel" ? (
                                                                            <>
                                                                                {t(`termsEmployer.privacyPage.${sub}`)}{" "}
                                                                                <a
                                                                                    className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                                                    href="mailto:support@ibrowe.com"
                                                                                    aria-label="Email support"
                                                                                >
                                                                                    {t("termsEmployer.privacyPage.contact_emailAddress")}
                                                                                </a>
                                                                            </>
                                                                        ) : (
                                                                            t(`termsEmployer.privacyPage.${sub}`)
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default PrivacyPolicy;