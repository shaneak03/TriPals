import { Logo } from "./logo";

const columns = [
  { title: "Product", links: ["True Cost Search", "Walk Optimizer", "Itineraries", "Buddy Match"] },
  { title: "Destinations", links: ["Milan", "Paris", "Barcelona", "Lisbon"] },
  { title: "Company", links: ["About us", "Methodology", "Careers"] },
  { title: "Legal", links: ["Privacy policy", "Terms of service"] },
];

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-ink/5">
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-10 pb-16 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-3 lg:col-span-1">
            <Logo size="sm" />
            <p className="text-sm leading-relaxed text-muted">The true cost and the best walk.</p>
            <p className="text-xs leading-relaxed text-muted">
              Public transport routing by <a href="https://transitous.org" target="_blank" rel="noreferrer" className="underline hover:text-ink">Transitous</a>.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
              <h4 className="text-[15px] font-semibold text-ink">{col.title}</h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((label) => (
                  <li key={label}>
                    <a href="#" className="text-sm text-muted transition-colors hover:text-ink">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-ink/5 pt-8 text-sm text-muted md:flex-row">
          <p>© {new Date().getFullYear()} TriPals. All rights reserved.</p>
          <p>Door-to-door transit intelligence &amp; scenic route scoring</p>
        </div>
      </div>
    </footer>
  );
}
