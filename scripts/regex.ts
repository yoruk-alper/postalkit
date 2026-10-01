// Build-time analysis of the small regex subset used by libaddressinput postal
// patterns: literals, \d, [classes], groups, |, and ?, *, +, {n}, {n,m}.
// Never shipped — the runtime only sees the compiled output.

export type Node =
  | { t: "set"; size: number; letters: boolean; src: string; chars: string } // literal, \d or [class]
  | { t: "seq"; items: Node[] }
  | { t: "alt"; items: Node[] }
  | { t: "rep"; node: Node; min: number; max: number };

export function parse(src: string): Node {
  let i = 0;
  const peek = () => src[i];

  function alt(): Node {
    const items = [seq()];
    while (peek() === "|") {
      i++;
      items.push(seq());
    }
    return items.length === 1 ? items[0] : { t: "alt", items };
  }

  function seq(): Node {
    const items: Node[] = [];
    while (i < src.length && peek() !== "|" && peek() !== ")") items.push(quant(atom()));
    return { t: "seq", items };
  }

  function quant(node: Node): Node {
    const c = peek();
    if (c === "?") return i++, { t: "rep", node, min: 0, max: 1 };
    if (c === "*") return i++, { t: "rep", node, min: 0, max: Infinity };
    if (c === "+") return i++, { t: "rep", node, min: 1, max: Infinity };
    if (c === "{") {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i));
      if (!m) throw new Error(`bad quantifier in ${src}`);
      i += m[0].length;
      const min = +m[1];
      const max = m[2] === undefined ? min : m[3] === "" ? Infinity : +m[3];
      return { t: "rep", node, min, max };
    }
    return node;
  }

  function atom(): Node {
    const c = src[i++];
    if (c === "(") {
      if (src.startsWith("?:", i)) i += 2;
      const inner = alt();
      if (src[i++] !== ")") throw new Error(`unclosed group in ${src}`);
      return inner;
    }
    if (c === "[") return cls();
    if (c === "\\") {
      const e = src[i++];
      if (e === "d") return { t: "set", size: 10, letters: false, src: "\\d", chars: "0123456789" };
      return { t: "set", size: 1, letters: /[A-Z]/.test(e), src: /[A-Z0-9]/.test(e) ? e : "\\" + e, chars: e };
    }
    if (c === "^" || c === "$") throw new Error(`anchors must be removed first: ${src}`);
    return { t: "set", size: 1, letters: /[A-Z]/.test(c), src: c, chars: c };
  }

  function cls(): Node {
    const start = i - 1;
    if (peek() === "^") throw new Error(`negated class in ${src}`);
    const chars = new Set<string>();
    while (peek() !== "]") {
      let a = src[i++];
      if (a === "\\") {
        const e = src[i++];
        if (e === "d") {
          for (let d = 0; d < 10; d++) chars.add(String(d));
          continue;
        }
        a = e;
      }
      if (peek() === "-" && src[i + 1] !== "]") {
        i++;
        let b = src[i++];
        if (b === "\\") b = src[i++];
        for (let k = a.charCodeAt(0); k <= b.charCodeAt(0); k++) chars.add(String.fromCharCode(k));
      } else chars.add(a);
    }
    i++;
    const list = [...chars].join("");
    return { t: "set", size: chars.size, letters: /[A-Z]/.test(list), src: src.slice(start, i), chars: list };
  }

  const node = alt();
  if (i !== src.length) throw new Error(`unexpected "${src[i]}" at ${i} in ${src}`);
  return node;
}

/** Shortest and longest string the pattern can match. */
export function lengths(n: Node): [number, number] {
  switch (n.t) {
    case "set":
      return [1, 1];
    case "seq":
      return n.items.reduce<[number, number]>((acc, it) => {
        const [a, b] = lengths(it);
        return [acc[0] + a, acc[1] + b];
      }, [0, 0]);
    case "alt": {
      const all = n.items.map(lengths);
      return [Math.min(...all.map((x) => x[0])), Math.max(...all.map((x) => x[1]))];
    }
    case "rep": {
      const [a, b] = lengths(n.node);
      return [a * n.min, b * n.max];
    }
  }
}

/** How many strings of each length the pattern matches (index = length, upper bound under alternation). */
export function countsByLength(n: Node): number[] {
  switch (n.t) {
    case "set":
      return [0, n.size];
    case "seq":
      return n.items.reduce((acc, it) => convolve(acc, countsByLength(it)), [1]);
    case "alt":
      return n.items.map(countsByLength).reduce((a, b) => a.map((x, i) => x + (b[i] ?? 0)).concat(b.slice(a.length)));
    case "rep": {
      const one = countsByLength(n.node);
      let power: number[] = [1];
      let total: number[] = [];
      for (let k = 0; k <= Math.min(n.max, 40); k++) {
        if (k >= n.min) total = total.map((x, i) => x + (power[i] ?? 0)).concat(power.slice(total.length));
        power = convolve(power, one);
      }
      return total;
    }
  }
}

function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(Math.min(a.length + b.length - 1, 41)).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => i + j < out.length && (out[i + j] += x * y)));
  return out;
}

/** Whether any matched string can contain a letter. */
export function hasLetters(n: Node): boolean {
  switch (n.t) {
    case "set":
      return n.letters;
    case "seq":
    case "alt":
      return n.items.some(hasLetters);
    case "rep":
      return hasLetters(n.node);
  }
}

// ---------------------------------------------------------------------------
// Optimizer: rewrite a pattern into a shorter equivalent. Smaller data, and the
// trie form of long alternations (the UK area list) is also faster to match.

type SetNode = Extract<Node, { t: "set" }>;

export function optimize(src: string): string {
  return emit(simplify(parse(src)), true);
}

function simplify(n: Node): Node {
  switch (n.t) {
    case "set":
      return n;
    case "rep": {
      const inner = simplify(n.node);
      if (n.min === 1 && n.max === 1) return inner;
      if (inner.t === "rep" && inner.min === inner.max && n.min === n.max)
        return { t: "rep", node: inner.node, min: inner.min * n.min, max: inner.max * n.max };
      return { t: "rep", node: inner, min: n.min, max: n.max };
    }
    case "seq": {
      const out: Node[] = [];
      for (const it of n.items.map(simplify).flatMap((x) => (x.t === "seq" ? x.items : [x]))) {
        const a = out.length ? run(out[out.length - 1]) : null;
        const b = run(it);
        // \d\d{4} -> \d{5}, but leave literal runs alone ("ZZ" is shorter than "Z{2}")
        if (a && b && a.set.src === b.set.src && a.set.size > 1) out[out.length - 1] = { t: "rep", node: a.set, min: a.min + b.min, max: a.max + b.max };
        else out.push(it);
      }
      return out.length === 1 ? out[0] : { t: "seq", items: out };
    }
    case "alt": {
      const items = n.items.map(simplify);
      const words = items.map(word);
      if (words.every((w): w is string => w !== null)) return trie(words);
      return { t: "alt", items };
    }
  }
}

function run(n: Node): { set: SetNode; min: number; max: number } | null {
  if (n.t === "set") return { set: n, min: 1, max: 1 };
  if (n.t === "rep" && n.node.t === "set") return { set: n.node, min: n.min, max: n.max };
  return null;
}

function word(n: Node): string | null {
  if (n.t === "set") return n.size === 1 && /^[A-Z0-9]$/.test(n.src) ? n.src : null;
  if (n.t !== "seq") return null;
  let w = "";
  for (const it of n.items) {
    const x = word(it);
    if (x === null) return null;
    w += x;
  }
  return w;
}

const lit = (c: string): SetNode => ({ t: "set", size: 1, letters: /[A-Z]/.test(c), src: c, chars: c });

/** (?:AB|AL|B|BA|BB) -> (?:A[BL]|B[AB]?) */
function trie(words: string[]): Node {
  const groups = new Map<string, string[]>();
  for (const w of new Set(words)) if (w) groups.set(w[0], [...(groups.get(w[0]) ?? []), w.slice(1)]);
  const singles: string[] = [];
  const alts: Node[] = [];
  for (const [c, rest] of groups) {
    if (rest.every((r) => r === "")) singles.push(c);
    else {
      const tail = trie(rest);
      alts.push({ t: "seq", items: [lit(c), ...(tail.t === "seq" ? tail.items : [tail])] });
    }
  }
  if (singles.length) {
    const chars = singles.sort().join("");
    alts.unshift(singles.length === 1 ? lit(chars) : { t: "set", size: chars.length, letters: /[A-Z]/.test(chars), src: `[${ranges(chars)}]`, chars });
  }
  const body: Node = alts.length === 1 ? alts[0] : { t: "alt", items: alts };
  return words.includes("") ? { t: "rep", node: body, min: 0, max: 1 } : body;
}

function ranges(sorted: string): string {
  let out = "";
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted.charCodeAt(j + 1) === sorted.charCodeAt(j) + 1) j++;
    out += j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1);
    i = j + 1;
  }
  return out;
}

function emit(n: Node, top = false): string {
  switch (n.t) {
    case "set":
      return n.src;
    case "seq":
      return n.items.map((it) => emit(it)).join("");
    case "alt": {
      const s = n.items.map((it) => emit(it, true)).join("|");
      return top ? s : `(?:${s})`;
    }
    case "rep": {
      const inner = n.node.t === "set" ? n.node.src : `(?:${emit(n.node, true)})`;
      const { min, max } = n;
      const q = min === max ? (min === 1 ? "" : `{${min}}`)
        : max === Infinity ? (min === 0 ? "*" : min === 1 ? "+" : `{${min},}`)
        : min === 0 && max === 1 ? "?" : `{${min},${max}}`;
      return inner + q;
    }
  }
}

// ---------------------------------------------------------------------------
// Fuzzing support: random strings that match a pattern, and near misses.

export function sample(n: Node, rnd: () => number): string {
  switch (n.t) {
    case "set":
      return n.chars[Math.floor(rnd() * n.chars.length)];
    case "seq":
      return n.items.map((it) => sample(it, rnd)).join("");
    case "alt":
      return sample(n.items[Math.floor(rnd() * n.items.length)], rnd);
    case "rep": {
      const max = Math.min(n.max, n.min + 3);
      const k = n.min + Math.floor(rnd() * (max - n.min + 1));
      let s = "";
      for (let i = 0; i < k; i++) s += sample(n.node, rnd);
      return s;
    }
  }
}

export function mutate(s: string, rnd: () => number): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const c = ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  const i = Math.floor(rnd() * (s.length + 1));
  const op = Math.floor(rnd() * 3);
  return op === 0 ? s.slice(0, i) + c + s.slice(i) : op === 1 ? s.slice(0, i) + s.slice(i + 1) : s.slice(0, i) + c + s.slice(i + 1);
}

/** Deterministic PRNG (mulberry32) so fuzz runs are reproducible. */
export function prng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
