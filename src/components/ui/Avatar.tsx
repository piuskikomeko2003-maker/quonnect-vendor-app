import { initials } from "@/lib/format";

interface AvatarProps {
  logoUrl?: string | null;
  name?: string | null;
  size?: "header" | "normal" | "big";
  className?: string;
}

export function Avatar({ logoUrl, name, size = "normal", className = "" }: AvatarProps) {
  const sizeClass =
    size === "header" ? "header-avatar" : size === "big" ? "bigav" : "";
  return (
    <span className={`av ${sizeClass} ${className}`.trim()} aria-hidden={!name}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name ? `${name} logo` : ""} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}
