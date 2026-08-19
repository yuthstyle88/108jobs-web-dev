import type { Config } from "tailwindcss";
import type { PluginAPI } from "tailwindcss/types/config";

const kanit = ["Kanit", "sans-serif"];

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                kanit,
            },
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: "var(--primary)",
                secondary: "var(--secondary)",
                third: "var(--third)",
                fourth: "var(--fourth)",
                fifth: "var(--fifth)",
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)",
                },
                success: {
                    DEFAULT: "var(--success)",
                    foreground: "var(--success-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },

                // ✅ แบบใหม่ (ขีดกลาง): ใช้ได้กับ `text-text-primary`, `text-text-secondary`
                text: {
                    primary: "var(--text-primary)",
                    secondary: "var(--text-secondary)",
                },
                // ✅ แบบใหม่ (ขีดกลาง) สำหรับ border: `border-border-primary`, `border-border-secondary`
                border: {
                    primary: "var(--border-primary)",
                    secondary: "var(--border-secondary)",
                },

                // ♻️ คงของเดิมไว้เพื่อไม่ให้โค้ดเก่าพัง (ใช้ `text-text_primary` เป็นต้น)
                text_primary: "var(--text-primary)",
                text_secondary: "var(--text-secondary)",
                border_primary: "var(--border-primary)",
                border_secondary: "var(--border-secondary)",

                skeleton: "var(--skeleton)",
                fastwork: {
                    blue: "#0078FF",
                    "deep-blue": "#0062CC",
                    "light-blue": "#0F9DFF",
                    "bright-blue": "#10A3FF",
                },
                verification: {
                    blue: "#0078FF",
                    background: "#f0f4fd",
                },
                darkOverlay: "rgba(43, 43, 43, 0.25)",
            },
            boxShadow: {
                panel: "0 0 1.5rem 0 rgba(25,72,142,.15)",
                megaMenu:
                    "0 1px 1px hsl(333deg 0% 50% / 15%), 0 2px 2px hsl(333deg 0% 50% / 15%), 0 4px 4px hsl(333deg 0% 50% / 15%), 0 8px 8px hsl(333deg 0% 50% / 15%), 0 16px 16px hsl(333deg 0% 50% / 15%), 0 32px 32px hsl(333deg 0% 50% / 15%), 0 64px 64px hsl(333deg 0% 50% / 15%)",
                categoryMenu: "0 4px 12px 0 rgba(43, 43, 43, .1)",
                subMenu: "0 0 1.5rem 0 rgba(25, 72, 142, .15)",
                toggle: "0 0 7px rgba(0, 0, 0, .5)",
                jobCard:
                    "0 1px 1px hsl(333deg 0% 50% /7.5%),0 2px 2px hsl(333deg 0% 50% /7.5%),0 4px 4px hsl(333deg 0% 50% /7.5%),0 8px 8px hsl(333deg 0% 50% /7.5%),0 16px 16px hsl(333deg 0% 50% /7.5%)",
                filterSection: "0 4px 12px 0 rgba(43, 43, 43, .1)",
                inputShadow: "box-shadow: 0 0 0 .175em hsl(5 85% 94%)",
                recipeShadow:
                    "0 1px 1px hsl(333deg 0% 50% /7.5%),0 2px 2px hsl(333deg 0% 50% /7.5%),0 4px 4px hsl(333deg 0% 50% /7.5%),0 8px 8px hsl(333deg 0% 50% /7.5%),0 16px 16px hsl(333deg 0% 50% /7.5%)",
                memberShipShadow:
                    "0 10px 40px -4px rgba(19, 55, 109, 0.08), 0 8px 22px -6px rgba(19, 55, 109, 0.1);",
                topWorkShadow: "0 0 1.5rem 0 rgba(24, 85, 184, .25);",
                reviewShadow: "0 0 1.5rem 0 rgba(24, 85, 184, .1);",
                howShadow: "0 8px 24px -4px #13376d0a,0 7px 12px -6px #13376d0f",
            },
            borderWidth: {
                1: "1px",
            },
            keyframes: {
                "fade-in": {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                "scale-up": {
                    "0%": { transform: "scale(0.95)", opacity: "0" },
                    "100%": { transform: "scale(1)", opacity: "1" },
                },
                "modal-fade-in": {
                    "0%": { opacity: "0", transform: "translateY(30px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "modal-fade-out": {
                    "0%": { opacity: "1", transform: "translateY(0)" },
                    "100%": { opacity: "0", transform: "translateY(30px)" },
                },
                "backdrop-fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                "backdrop-fade-out": {
                    "0%": { opacity: "1" },
                    "100%": { opacity: "0" },
                },
                loader1: {
                    "0%": { transform: "scale(0)" },
                    "100%": { transform: "scale(1)" },
                },
                loader2: {
                    "0%": { transform: "translate(0)" },
                    "100%": { transform: "translate(1.5rem)" },
                },
                loader3: {
                    "0%": { transform: "scale(1)" },
                    "100%": { transform: "scale(0)" },
                },
                "fade-down": {
                    "0%": { opacity: "0", transform: "translateY(-10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                shimmer: {
                    "100%": { transform: "translateX(100%)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.6s ease-out",
                float: "float 6s ease-in-out infinite",
                "scale-up": "scale-up 0.5s ease-out",
                "spin-fast": "spin 600ms linear infinite",
                "modal-show": "modal-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "modal-hide": "modal-fade-out 0.2s ease-out forwards",
                "backdrop-show": "backdrop-fade-in 0.2s ease-out forwards",
                "backdrop-hide": "backdrop-fade-out 0.2s ease-out forwards",
                loader1: "loader1 0.6s infinite",
                loader2: "loader2 0.6s infinite",
                loader3: "loader3 0.6s infinite",
                "fade-down": "fade-down 0.1s ease-out",
                shimmer: "shimmer 1.5s infinite",
            },
        },
    },
    plugins: [
        function ({ addUtilities }: PluginAPI) {
            addUtilities({
                ".rounded-reward-sp": {
                    borderRadius: "100% 100% 0px 0px / 100% 100% 0% 0%",
                },
                ".rounded-reward-pc": {
                    borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                },
            });
        },
    ],
};
export default config;
