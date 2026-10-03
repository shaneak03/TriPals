export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={`flex flex-col gap-[3px] ${small ? "w-4" : "w-5"}`}>
        <span className={`block w-full rounded-full bg-primary ${small ? "h-[2px]" : "h-[2.5px]"}`} />
        <span className={`block w-[70%] rounded-full bg-primary ${small ? "h-[2px]" : "h-[2.5px]"}`} />
        <span className={`block w-full rounded-full bg-primary ${small ? "h-[2px]" : "h-[2.5px]"}`} />
      </span>
      <span className={`font-semibold tracking-tight text-ink ${small ? "text-lg" : "text-[22px]"}`}>
        TriPals
      </span>
    </span>
  );
}
