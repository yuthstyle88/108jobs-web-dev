import {cookies} from "next/headers";
import {LANGUAGE_COOKIE, VALID_LANGUAGES} from "@/constants/language";
import notFoundIllustration from "@/assets/images/not-found-illustration.png";
import Link from "next/link";
import Image from "next/image";

export default async function NotFoundPage() {
    const cookiesList = await cookies();
    const langCookie = cookiesList.get(LANGUAGE_COOKIE)?.value;
    const lang = langCookie && VALID_LANGUAGES.includes(langCookie) ? langCookie : "en";

    return (
        <main style={{
            alignItems: "center",
            background: "linear-gradient(180deg, #062f51 0, #062f51 29rem, #f8fafc 29rem)",
            color: "#052f51",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
        }}>
            <section style={{
                background: "#fff",
                borderRadius: "1.5rem",
                boxShadow: "0 24px 80px rgba(4, 43, 74, 0.18)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(17rem, 1fr))",
                maxWidth: "62rem",
                overflow: "hidden",
                width: "100%",
            }}>
                <div style={{
                    alignItems: "center",
                    background: "radial-gradient(circle at 25% 15%, #c6eafa 0, #eaf6fd 42%, #d9effa 100%)",
                    display: "flex",
                    justifyContent: "center",
                    minHeight: "22rem",
                    padding: "2rem",
                }}>
                    <Image
                    priority
                    src={notFoundIllustration}
                    alt="A helpful robot holding a map beside a broken link"
                    sizes="(min-width: 640px) 360px, 280px"
                    style={{height: "auto", maxWidth: "23rem", width: "100%"}}
                    />
                </div>
                <div style={{
                    alignItems: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "3rem 2.25rem",
                }}>
                    <p style={{
                        background: "#e7f5fd",
                        borderRadius: "999px",
                        color: "#076497",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        margin: 0,
                        padding: "0.45rem 0.8rem",
                    }}>404</p>
                    <h1 style={{fontSize: "2.25rem", margin: "1.25rem 0 0"}}>Page Not Found</h1>
                    <p style={{color: "#475569", fontSize: "1.125rem", lineHeight: 1.6, margin: "1rem 0 2rem", maxWidth: "28rem"}}>
                        We couldn’t find the page you were looking for. It may have moved or the link may be out of date.
                    </p>
                    <Link
                        href={`/${lang}`}
                        style={{
                            background: "#062f51",
                            borderRadius: "0.75rem",
                            color: "white",
                            display: "inline-block",
                            fontWeight: 700,
                            padding: "0.875rem 1.25rem",
                            textDecoration: "none",
                        }}
                    >
                        Back to Home
                    </Link>
                </div>
            </section>
        </main>
    );
}
