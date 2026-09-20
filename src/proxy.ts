import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 renamed Middleware → Proxy (same runtime, same matcher convention).
export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(en|hi|ta)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};