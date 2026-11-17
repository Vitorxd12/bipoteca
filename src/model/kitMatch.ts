/**
 * Casamento de linhas ao trocar de kit: cada som novo herda a linha (e as
 * notas) do som antigo que faz o mesmo papel. Assim o chimbal continua no
 * chimbal mesmo que os kits tenham ordens diferentes.
 */
import { presetInfo } from "@/audio/registry";
import type { KitRow, PresetRef } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Papel do som pelo nome: sinônimos viram a mesma chave. */
const ROLES: [RegExp, string][] = [
  [/bumbo|kick|bass drum/, "kick"],
  [/caixa|snare/, "snare"],
  [/palma|clap/, "clap"],
  [/aro|rim|stick/, "rim"],
  [/chimbal (fechado|fec)|hh ?closed|hihat closed|chimbal$/, "hh-closed"],
  [/chimbal aberto|hh ?open|hihat open/, "hh-open"],
  [/prato|crash|cymbal/, "crash"],
  [/conducao|ride/, "ride"],
  [/tom grave|tom low|floor/, "tom-low"],
  [/tom medio|tom mid/, "tom-mid"],
  [/tom agudo|tom hi/, "tom-high"],
  [/^tom/, "tom-mid"],
  [/conga grave|conga low/, "conga-low"],
  [/conga/, "conga-high"],
  [/cowbell/, "cowbell"],
  [/clave/, "clave"],
  [/chocalho|maraca|shaker|cabasa/, "shaker"],
  [/pandeirola|tamb/, "tambourine"],
];

function role(name: string): string | null {
  const n = norm(name);
  for (const [re, key] of ROLES) if (re.test(n)) return key;
  return null;
}

/**
 * Para cada linha nova, devolve a linha antiga que ela herda (ou null).
 * Também devolve as linhas antigas que ficaram sem par (perdem as notas).
 */
export function matchKitRows(
  oldRows: KitRow[],
  newRows: { name: string; preset: PresetRef }[],
): { pairs: (KitRow | null)[]; lost: KitRow[] } {
  const used = new Set<string>();
  const pairs: (KitRow | null)[] = newRows.map(() => null);
  const take = (i: number, test: (o: KitRow) => boolean) => {
    if (pairs[i]) return;
    const o = oldRows.find((r) => !used.has(r.id) && test(r));
    if (o) {
      pairs[i] = o;
      used.add(o.id);
    }
  };
  // 1. mesmo nome · 2. mesmo papel · 3. mesma família · 4. sobra por posição
  for (const [i, n] of newRows.entries()) take(i, (o) => norm(o.name) === norm(n.name));
  newRows.forEach((n, i) => {
    const r = role(n.name);
    if (r) take(i, (o) => role(o.name) === r);
  });
  newRows.forEach((n, i) => {
    const g = presetInfo(n.preset)?.group;
    if (g) take(i, (o) => presetInfo(o.preset)?.group === g && role(o.name) === null);
  });
  return { pairs, lost: oldRows.filter((o) => !used.has(o.id)) };
}
