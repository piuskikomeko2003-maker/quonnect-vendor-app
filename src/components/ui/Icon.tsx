import type { SVGProps } from "react";
import type { IconKey } from "@/lib/constants";

const ICONS: Record<IconKey, React.ReactNode> = {
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M8 14h2M14 14h2M8 17.5h2" />
    </>
  ),
  bars: <path d="M6 20v-9M12 20V5M18 20v-6" strokeWidth="3" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  plusc: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  moneybag: (
    <>
      <path d="M9 3h6l-1.5 3h-3z" />
      <path d="M10.5 6C6 8 4 12 4 15.5 4 19 7.5 21 12 21s8-2 8-5.5C20 12 18 8 13.5 6" />
      <path d="M14 12.3c-.5-.5-1.2-.8-2-.8-1.2 0-2 .6-2 1.5s.8 1.3 2 1.5 2 .6 2 1.5-.8 1.5-2 1.5c-.8 0-1.6-.3-2-.8M12 10.5v1M12 16.5v1" />
    </>
  ),
  swap: <path d="M4 8h15l-3-3.5M20 16H5l3 3.5" />,
  cart: (
    <>
      <path d="M3 4h3l2.5 11h9.5l2-8H7" />
      <circle cx="10" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  car: (
    <>
      <path d="M5 15l1.5-5.5A2 2 0 018.4 8h7.2a2 2 0 011.9 1.5L19 15" />
      <rect x="3" y="14" width="18" height="5" rx="2" />
      <circle cx="7.5" cy="16.5" r=".7" />
      <circle cx="16.5" cy="16.5" r=".7" />
    </>
  ),
  utensils: <path d="M6 3v8M4 3v5a2 2 0 004 0V3M6 11v10M17 3c-2 2-3 5-3 8h3v10" />,
  chevr: <path d="M9 5l7 7-7 7" />,
  chevd: <path d="M5 9l7 7 7-7" />,
  mobile: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  box: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" />
    </>
  ),
  store: (
    <>
      <path d="M3 9l2-5h14l2 5" />
      <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
      <path d="M5 12v8h14v-8" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  shirt: <path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" />,
  basket: (
    <>
      <path d="M3 10h18l-2 10H5z" />
      <path d="M8 10l4-6 4 6" />
    </>
  ),
  bottle: (
    <>
      <path d="M10 3h4v3l2 3v11a1 1 0 01-1 1H9a1 1 0 01-1-1V9l2-3z" />
      <path d="M8 13h8" />
    </>
  ),
  shoe: <path d="M3 16c0-3 1-5 2-7l3 2 2-2c1 3 4 4 8 5 2 .5 3 1 3 3v1H3z" />,
  bag: (
    <>
      <path d="M5 8h14l1 12H4z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </>
  ),
  jeans: (
    <>
      <path d="M7 3h10l1 18h-5l-1-10-1 10H6z" />
      <path d="M7 7h10" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  quote: <path d="M5 17c0-4 1-7 4-9M13 17c0-4 1-7 4-9" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" />
    </>
  ),
  facebook: <path d="M15 3h-2.5A4.5 4.5 0 008 7.5V10H5v4h3v7h4v-7h3l1-4h-4V7.5c0-.3.2-.5.5-.5H15z" />,
  tiktok: (
    <>
      <path d="M14 3v11.5a3.5 3.5 0 11-3.5-3.5" />
      <path d="M14 3c.3 2.5 2 4.2 5 4.5" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.4-4.3A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.2-1.1z" />
      <path d="M9 9c0 3 3 6 6 6l1-2-2-1-1 .7c-1-.5-1.7-1.2-2.2-2.2L11.5 9l-1-2z" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconKey;
  size?: number;
}

export function Icon({ name, size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, verticalAlign: "middle" }}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {ICONS[name] ?? ICONS.box}
    </svg>
  );
}
