// Nagłówek kroku wg COnboarding / CMOnboarding (.step-title): tytuł 24/32 (600, -0.02em) i opis muted 14 px.
// `phoneSubtitle`: inny opis na telefonie (makiety CM kończą opisy kropką) — dwa <span> przełączane klasami breakpointu.
export function StepHeader({
  title,
  subtitle,
  phoneSubtitle,
}: {
  title: string;
  subtitle: string;
  phoneSubtitle?: string;
}) {
  return (
    <div>
      <h1 className="m-0 text-2xl leading-8 font-semibold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="m-0 mt-1.5 text-sm text-muted-foreground">
        {phoneSubtitle ? (
          <>
            <span className="max-[799px]:hidden">{subtitle}</span>
            <span className="min-[800px]:hidden">{phoneSubtitle}</span>
          </>
        ) : (
          subtitle
        )}
      </p>
    </div>
  );
}
