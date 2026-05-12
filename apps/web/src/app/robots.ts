import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/platform", "/auth", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
