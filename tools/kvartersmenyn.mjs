// Tolkning av kvartersmenyns get_menu-svar.
// FÖRSTA STEGET: parseMenu returnerar null tills svarets struktur är granskad.
// describe() ger en anonymiserad bild av strukturen: fältnamn, typer och början av varje text.

export function describe(v, depth = 0) {
  if (depth > 6) return "…";
  if (Array.isArray(v)) return v.length ? [describe(v[0], depth + 1), `(${v.length} element)`] : [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, describe(x, depth + 1)]));
  if (typeof v === "string") return v.length > 160 ? `text(${v.length}): ${v.slice(0, 160)}…` : `text(${v.length}): ${v}`;
  return `${typeof v}: ${v}`;
}

export function parseMenu(/* json */) {
  return null;
}
