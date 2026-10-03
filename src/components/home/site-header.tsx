import Link from "next/link";
import { Logo } from "./logo";

const navLinks = [
  { id: "flights", label: "Flights", href: "/#true-cost" },
  { id: "walks", label: "Walks", href: "/walks" },
  { id: "itineraries", label: "Itineraries", href: "/#itineraries" },
] as const;

export function SiteHeader({ active }: { active?: (typeof navLinks)[number]["id"] }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/5 bg-sand/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:h-20 lg:px-8">
        <Link href="/" aria-label="TriPals home" className="flex min-h-11 items-center">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={link.id === active ? "page" : undefined}
              className="text-[15px] text-muted transition-colors hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <a
            href="#"
            className="hidden text-[15px] font-medium text-muted transition-colors hover:text-ink sm:inline"
          >
            Sign in
          </a>
          <a
            href="#"
            className="inline-flex h-11 items-center rounded-control bg-primary px-5 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}
