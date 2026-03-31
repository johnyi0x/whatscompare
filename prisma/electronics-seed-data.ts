/** Curated electronics catalog: ~36 SKUs. `shoppingQuery` + optional `shoppingMatchHint` for Claude enrichment. */
export type ElectronicsSeedRow = {
  slug: string;
  title: string;
  category: string;
  brand?: string;
  shoppingQuery: string;
  shoppingMatchHint?: string;
};

export const ELECTRONICS_SEED: ElectronicsSeedRow[] = [
  { slug: "sony-wh-1000xm5", title: "Sony WH-1000XM5", category: "Headphones", brand: "Sony", shoppingQuery: "Sony WH-1000XM5 wireless headphones", shoppingMatchHint: "1000XM5" },
  { slug: "apple-airpods-pro-2", title: "Apple AirPods Pro 2", category: "Earbuds", brand: "Apple", shoppingQuery: "Apple AirPods Pro 2nd generation USB-C", shoppingMatchHint: "AirPods Pro" },
  { slug: "bose-quietcomfort-ultra", title: "Bose QuietComfort Ultra Headphones", category: "Headphones", brand: "Bose", shoppingQuery: "Bose QuietComfort Ultra headphones", shoppingMatchHint: "QuietComfort Ultra" },
  { slug: "samsung-galaxy-s24-ultra", title: "Samsung Galaxy S24 Ultra", category: "Phones", brand: "Samsung", shoppingQuery: "Samsung Galaxy S24 Ultra 256GB unlocked", shoppingMatchHint: "S24 Ultra" },
  { slug: "google-pixel-9-pro", title: "Google Pixel 9 Pro", category: "Phones", brand: "Google", shoppingQuery: "Google Pixel 9 Pro 128GB", shoppingMatchHint: "Pixel 9 Pro" },
  { slug: "iphone-16-pro", title: "Apple iPhone 16 Pro", category: "Phones", brand: "Apple", shoppingQuery: "Apple iPhone 16 Pro 256GB", shoppingMatchHint: "iPhone 16 Pro" },
  { slug: "ipad-air-m2", title: "Apple iPad Air M2 11 inch", category: "Tablets", brand: "Apple", shoppingQuery: "Apple iPad Air 11 inch M2 128GB", shoppingMatchHint: "iPad Air" },
  { slug: "kindle-paperwhite-2024", title: "Amazon Kindle Paperwhite", category: "E-readers", brand: "Amazon", shoppingQuery: "Kindle Paperwhite 16GB 2024", shoppingMatchHint: "Paperwhite" },
  { slug: "meta-quest-3", title: "Meta Quest 3 128GB", category: "VR", brand: "Meta", shoppingQuery: "Meta Quest 3 128GB VR headset", shoppingMatchHint: "Quest 3" },
  { slug: "nintendo-switch-oled", title: "Nintendo Switch OLED", category: "Gaming", brand: "Nintendo", shoppingQuery: "Nintendo Switch OLED console", shoppingMatchHint: "Switch OLED" },
  { slug: "ps5-slim-disc", title: "PlayStation 5 Slim Disc", category: "Gaming", brand: "Sony", shoppingQuery: "PlayStation 5 Slim disc edition", shoppingMatchHint: "PS5" },
  { slug: "xbox-series-x", title: "Xbox Series X", category: "Gaming", brand: "Microsoft", shoppingQuery: "Xbox Series X console", shoppingMatchHint: "Series X" },
  { slug: "steam-deck-oled-512", title: "Steam Deck OLED 512GB", category: "Gaming", brand: "Valve", shoppingQuery: "Steam Deck OLED 512GB handheld", shoppingMatchHint: "Steam Deck" },
  { slug: "lg-c4-55-oled", title: "LG C4 55 inch OLED TV", category: "TVs", brand: "LG", shoppingQuery: "LG C4 55 inch OLED evo 4K TV", shoppingMatchHint: "C4" },
  { slug: "samsung-qn90d-65", title: "Samsung 65 inch QN90D Neo QLED", category: "TVs", brand: "Samsung", shoppingQuery: "Samsung 65 inch QN90D Neo QLED 4K TV", shoppingMatchHint: "QN90D" },
  { slug: "tcl-6-series-55", title: "TCL 55 inch Q6 QLED 4K TV", category: "TVs", brand: "TCL", shoppingQuery: "TCL 55 inch Q6 QLED 4K Google TV", shoppingMatchHint: "TCL Q6" },
  { slug: "macbook-air-m3-15", title: "MacBook Air 15 inch M3", category: "Laptops", brand: "Apple", shoppingQuery: "MacBook Air 15 inch M3 256GB", shoppingMatchHint: "MacBook Air" },
  { slug: "thinkpad-x1-carbon-g12", title: "Lenovo ThinkPad X1 Carbon Gen 12", category: "Laptops", brand: "Lenovo", shoppingQuery: "Lenovo ThinkPad X1 Carbon Gen 12 laptop", shoppingMatchHint: "X1 Carbon" },
  { slug: "dell-xps-14-9440", title: "Dell XPS 14 9440", category: "Laptops", brand: "Dell", shoppingQuery: "Dell XPS 14 9440 laptop", shoppingMatchHint: "XPS 14" },
  { slug: "asus-rog-zephyrus-g14", title: "ASUS ROG Zephyrus G14", category: "Laptops", brand: "ASUS", shoppingQuery: "ASUS ROG Zephyrus G14 gaming laptop", shoppingMatchHint: "Zephyrus G14" },
  { slug: "framework-laptop-13", title: "Framework Laptop 13", category: "Laptops", brand: "Framework", shoppingQuery: "Framework Laptop 13 DIY edition", shoppingMatchHint: "Framework" },
  { slug: "nvidia-rtx-4070-super-fe", title: "NVIDIA GeForce RTX 4070 Super", category: "GPUs", brand: "NVIDIA", shoppingQuery: "NVIDIA GeForce RTX 4070 Super graphics card", shoppingMatchHint: "4070 Super" },
  { slug: "amd-rx-7800-xt", title: "AMD Radeon RX 7800 XT", category: "GPUs", brand: "AMD", shoppingQuery: "AMD Radeon RX 7800 XT graphics card", shoppingMatchHint: "7800 XT" },
  { slug: "samsung-990-pro-2tb", title: "Samsung 990 PRO 2TB NVMe SSD", category: "Storage", brand: "Samsung", shoppingQuery: "Samsung 990 PRO 2TB NVMe SSD", shoppingMatchHint: "990 PRO" },
  { slug: "crucial-t700-2tb", title: "Crucial T700 2TB Gen5 SSD", category: "Storage", brand: "Crucial", shoppingQuery: "Crucial T700 2TB PCIe Gen5 SSD", shoppingMatchHint: "T700" },
  { slug: "logitech-mx-keys-s", title: "Logitech MX Keys S", category: "Peripherals", brand: "Logitech", shoppingQuery: "Logitech MX Keys S wireless keyboard", shoppingMatchHint: "MX Keys" },
  { slug: "logitech-mx-master-3s", title: "Logitech MX Master 3S", category: "Peripherals", brand: "Logitech", shoppingQuery: "Logitech MX Master 3S mouse", shoppingMatchHint: "MX Master 3S" },
  { slug: "keychron-q1-pro", title: "Keychron Q1 Pro", category: "Peripherals", brand: "Keychron", shoppingQuery: "Keychron Q1 Pro mechanical keyboard", shoppingMatchHint: "Q1 Pro" },
  { slug: "lg-27gp850-b", title: "LG UltraGear 27GP850-B 27 inch", category: "Monitors", brand: "LG", shoppingQuery: "LG UltraGear 27GP850-B 27 inch gaming monitor", shoppingMatchHint: "27GP850" },
  { slug: "dell-u2723qe", title: "Dell UltraSharp U2723QE 27 inch 4K", category: "Monitors", brand: "Dell", shoppingQuery: "Dell UltraSharp U2723QE 27 inch 4K monitor", shoppingMatchHint: "U2723QE" },
  { slug: "gopro-hero-12", title: "GoPro HERO12 Black", category: "Cameras", brand: "GoPro", shoppingQuery: "GoPro HERO12 Black action camera", shoppingMatchHint: "HERO12" },
  { slug: "sony-alpha-6700", title: "Sony a6700 mirrorless camera", category: "Cameras", brand: "Sony", shoppingQuery: "Sony Alpha a6700 mirrorless camera body", shoppingMatchHint: "a6700" },
  { slug: "anker-prime-200w-power-bank", title: "Anker Prime 200W 20,000mAh power bank", category: "Accessories", brand: "Anker", shoppingQuery: "Anker Prime 200W 20000mAh power bank", shoppingMatchHint: "Anker Prime" },
  { slug: "anker-nano-charger-100w", title: "Anker Nano 100W USB-C charger", category: "Accessories", brand: "Anker", shoppingQuery: "Anker Nano 100W USB C GaN charger", shoppingMatchHint: "Nano 100W" },
  { slug: "eero-max-7-router", title: "Amazon eero Max 7 mesh Wi-Fi 7 router", category: "Networking", brand: "Amazon", shoppingQuery: "Amazon eero Max 7 WiFi 7 mesh router", shoppingMatchHint: "eero Max 7" },
  { slug: "ubiquiti-u6-pro", title: "Ubiquiti UniFi U6 Pro access point", category: "Networking", brand: "Ubiquiti", shoppingQuery: "Ubiquiti UniFi U6 Pro WiFi access point", shoppingMatchHint: "U6 Pro" },
  { slug: "philips-hue-starter-kit", title: "Philips Hue White and Color starter kit", category: "Smart home", brand: "Philips Hue", shoppingQuery: "Philips Hue White and Color Ambiance starter kit 3 bulbs", shoppingMatchHint: "Hue" },
];
