import { Icon } from "@/components/ui/Icon";

export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="authhero">
      <div className="mark">
        <Icon name="store" size={32} />
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
