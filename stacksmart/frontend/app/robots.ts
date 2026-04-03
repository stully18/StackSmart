import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/settings', '/tools/'],
    },
    sitemap: 'https://stacksmart.app/sitemap.xml',
  }
}
