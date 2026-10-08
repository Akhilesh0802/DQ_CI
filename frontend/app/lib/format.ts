// Backend naive UTC datetime bhejta hai (timezone suffix ke bina). Browser use local maan leta hai,
// isliye IST mein ~5.5 ghante galat dikhta tha. Z lagake UTC batate hain, phir local mein dikhate hain.
export function formatServerDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(iso);
  return new Date(hasZone ? iso : iso + "Z").toLocaleString();
}
