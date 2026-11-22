// Nagłówek kroku wg COnboarding: tytuł 24/32 (600, -0.02em) i opis muted 14 px (web),
// na telefonie tytuł 26 px
export function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1 className="m-0 text-2xl leading-8 font-semibold tracking-[-0.02em] max-[799px]:text-[26px]">
        {title}
      </h1>
      <p className="m-0 mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
