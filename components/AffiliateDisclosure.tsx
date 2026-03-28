export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm leading-relaxed text-ink-muted ${className}`}
      role="note"
    >
      <strong className="font-medium text-ink">Affiliate disclosure.</strong> WhatsCompare earns from qualifying
      purchases through links to Amazon and other merchants we cover. You pay the same price; we may receive a
      commission. Program rules for your locale apply—see{" "}
      <a
        href="https://affiliate-program.amazon.com/help/operating/agreement"
        className="text-accent underline-offset-2 hover:underline"
        rel="noopener noreferrer"
        target="_blank"
      >
        Amazon Associates Program Operating Agreement
      </a>{" "}
      (US example) and your signed terms.
    </aside>
  );
}
