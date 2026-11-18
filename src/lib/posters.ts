import type { AdSlide } from "@/components/ui/AdCarousel";

export const POSTERS: AdSlide[] = [
  {
    id: "marketplace-celebration",
    image: "/ads/marketplace-celebration.png",
    title: "Check out the Quonnect Online Marketplace",
    link: "/stall",
    active: true,
  },
  {
    id: "restock-reminder",
    image: "/ads/restock-reminder.svg",
    title: "Never run out of best sellers",
    link: "/stock",
    active: true,
  },
  {
    id: "online-stall",
    image: "/ads/online-stall.svg",
    title: "Your stall, now online",
    link: "/stall",
    active: true,
  },
];
