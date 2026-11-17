// Nagłówek kroku: tytuł 24/32 i podtytuł (web), na telefonie tytuł 26 px
export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="m-0 text-2xl leading-8 font-medium tracking-[-0.01em] max-[799px]:text-[26px]">
        {title}
      </h1>
      <p className="m-0 mt-2 text-[#525252] max-[799px]:mt-1.5">{subtitle}</p>
    </div>
  );
}
