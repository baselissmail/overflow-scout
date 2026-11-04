/**
 * Curated, realistic long strings for interactive testing (the Inspect presets).
 *
 * Rules for every entry:
 * - Names are fictional and cover many scripts, diacritics and naming customs.
 * - Products are generic (no trademarks).
 * - URLs and emails only use reserved domains (`.example`, `example.com/.net/.org`,
 *   RFC 2606) so a test string can never point at a real site or inbox.
 */
export const PRESET_POOLS = {
  longName: [
    'María José Fernández-Villalobos de la Cruz',
    'Jean-Baptiste Aurélien Delacroix-Montfort',
    'Nguyễn Thị Phương Thảo Hoàng',
    'Wojciech Grzegorz Brzęczyszczykiewicz',
    'Þórunn Guðmundsdóttir Sigurðardóttir',
    'Oluwaseun Adebayo Okonkwo-Adeyemi',
    'Aleksandra Konstantinovna Vasilyeva-Orlova',
    'Siddharth Venkataraman Subramanian Iyer',
    'Leilani Kaʻiulani Makoa-Kealoha',
    'Abdulrahman Khalid Al-Mansouri',
    'Hans-Joachim Friedrich von Hohenberg-Lindau',
    'Çağla Gülşen Öztürk-Yılmaz',
  ],
  product: [
    'Professional 16-inch Laptop, 64 GB RAM, 2 TB SSD, Space Gray',
    'Wireless Noise-Cancelling Over-Ear Headphones with 40-Hour Battery',
    'Ergonomic Mesh Office Chair with Adjustable Lumbar Support (Large)',
    'Stainless Steel 12-Cup Programmable Coffee Maker with Thermal Carafe',
    '65-inch 4K OLED Smart TV with Dolby Vision and 120 Hz Refresh Rate',
    'Full-Frame Mirrorless Camera Body with 61 MP Sensor and Dual Card Slots',
    'Cordless Stick Vacuum with Laser Dust Detection and HEPA Filtration',
    'Organic Cold-Pressed Extra Virgin Olive Oil, 1 Litre (Pack of 3)',
    "Children's Waterproof Hiking Boots, Wide Fit, EU 34 / UK 1.5",
    'Annual Premium Subscription — Unlimited Projects, Priority Support',
    'Adjustable Standing Desk Frame with Memory Presets, 160 × 80 cm',
    'Smart Thermostat with Room Sensors, Energy Reports and Geofencing',
  ],
  url: [
    'https://www.very-long-company-name-for-testing.example/products/category/item?id=12345',
    'https://subdomain.another-long-website-address.example/en-gb/account/preferences',
    'https://api.v2.production.eu-central-1.services.example.com/v1/accounts/settings',
    'https://docs.developer-resources-portal.example/guides/getting-started/installation',
    'https://cdn.static-assets-delivery-network.example.net/images/hero-banner@2x.webp',
    'https://auth.secure-authentication-service.example.org/oauth2/authorize?client_id=abc',
    'https://shop.international-electronics-store.example/en-gb/checkout/payment-details',
    'https://support.customer-service-helpdesk.example/tickets/2026/11/000123456',
    'https://analytics.data-tracking-dashboard.example.com/reports/quarterly/q4-summary',
    'https://admin.enterprise-management-console.example/settings/organization/billing',
    'https://münchen-stadtführungen.example/touren/altstadt-und-viktualienmarkt',
    'https://storage.cloud-backup-service-provider.example.net/buckets/archive-2026',
  ],
  email: [
    'firstname.lastname@international-corporation.example.com',
    'customer.success@client-relations-management.example',
    'accounts.payable@financial-services-department.example.org',
    'security.alerts@cybersecurity-operations-center.example.net',
    'partnership.opportunities@strategic-alliances.example',
    'maría.fernández-villalobos@universidad-autónoma.example',
    'notifications+weekly-digest@product-updates.example.com',
    'very.long.first.name.and.last.name@subdomain.department.example.org',
    'human.resources@talent-acquisition-office.example',
    'no-reply.transactional-emails@mail.ecommerce-platform.example.net',
  ],
  longText: [
    'This is an exceptionally long piece of text designed to test how interfaces handle extended content that spans multiple lines, potentially causing overflow, truncation or other layout issues in constrained spaces.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'The quick brown fox jumps over the lazy dog several times in a row while demonstrating how typographic rendering and layout algorithms handle long sequences of characters in different contexts and viewport sizes.',
    'Error: An unexpected problem occurred while processing your request because of conflicting configuration settings. Please review your account preferences or contact your administrator for further assistance.',
    'Customer review: I have been using this service across several projects for years, and the reliability, documentation, responsive support team and steady stream of thoughtful improvements have consistently exceeded my expectations.',
    'Legal notice: By accessing or using this application you acknowledge that you have read, understood and agree to be bound by these terms, including limitations of liability, warranty disclaimers and dispute resolution procedures.',
    'Technical specifications: eight performance cores at 3.5 GHz with boost up to 5.0 GHz, 32 MB shared cache, integrated graphics, support for DDR5-4800 memory and PCIe 5.0 peripherals.',
    'Shipping update: Your order has left our regional distribution centre and is expected to arrive within three to five business days, depending on customs processing and local carrier capacity in your area.',
  ],
} as const satisfies Record<string, readonly [string, ...string[]]>;

/** A family of preset strings, e.g. `longName` or `url`. */
export type PresetKind = keyof typeof PRESET_POOLS;

/** All preset kinds, in display order. */
export const PRESET_KINDS = [
  'longName',
  'product',
  'url',
  'email',
  'longText',
] as const satisfies readonly PresetKind[];

/**
 * Returns the preset at `index` within its pool, wrapping around in both
 * directions so callers can cycle with a plain counter.
 */
export function getPreset(kind: PresetKind, index: number): string {
  const pool: readonly [string, ...string[]] = PRESET_POOLS[kind];
  const position = ((Math.trunc(index) % pool.length) + pool.length) % pool.length;
  return pool[position] ?? pool[0];
}
