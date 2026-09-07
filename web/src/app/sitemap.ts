import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://rentleaks.com/",
      lastModified: "2026-09-07",
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
