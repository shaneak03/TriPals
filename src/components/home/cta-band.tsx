export function CtaBand() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-5 pb-24 lg:px-8 lg:pb-40">
      <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-12 text-center shadow-card lg:p-16">
        <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
          See more. Spend smart. Stress less.
        </h2>
        <p className="mt-3 max-w-[560px] text-lg leading-relaxed text-muted">
          Join thousands of travellers finding true door-to-door value across Europe.
        </p>
        <a
          href="#"
          className="mt-8 inline-flex h-12 items-center rounded-control bg-primary px-8 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover active:scale-[0.98]"
        >
          Plan your trip
        </a>
      </div>
    </section>
  );
}
