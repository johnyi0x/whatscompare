/** Site name always lowercase: whats + compare (mint) — avoids “WC” abbreviation reads. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-ink">whats</span>
      <span className="text-compare">compare</span>
    </span>
  );
}
