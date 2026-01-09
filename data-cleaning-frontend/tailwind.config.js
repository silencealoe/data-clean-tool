/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-in-out",
                "slide-in-from-top": "slideInFromTop 0.5s ease-out",
                "slide-in-from-bottom": "slideInFromBottom 0.5s ease-out",
                "slide-in-from-left": "slideInFromLeft 0.5s ease-out",
                "slide-in-from-right": "slideInFromRight 0.5s ease-out",
                "zoom-in": "zoomIn 0.5s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideInFromTop: {
                    "0%": { opacity: "0", transform: "translateY(-1rem)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInFromBottom: {
                    "0%": { opacity: "0", transform: "translateY(1rem)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInFromLeft: {
                    "0%": { opacity: "0", transform: "translateX(-1rem)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                slideInFromRight: {
                    "0%": { opacity: "0", transform: "translateX(1rem)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                zoomIn: {
                    "0%": { opacity: "0", transform: "scale(0.5)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
            },
        },
    },
    plugins: [],
}