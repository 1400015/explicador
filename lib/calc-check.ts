/**
 * Verificador de cálculo: a criança escreve a sua conta e a app diz só se o
 * resultado está certo ou errado — sem resolver pela criança.
 * Avaliação 100% local, sem rede.
 */

export type CalcCheck =
  | { kind: "not-calc" }
  | { kind: "ok" }
  | { kind: "wrong"; expected: number };

const OPERATORS = ["+", "-", "*", "/", "(", ")", "."];

function tokenize(expr: string): string[] | null {
  const tokens: string[] = [];
  let num = "";
  for (const ch of expr.replace(/\s+/g, "").replace(/,/g, ".")) {
    if (/[0-9.]/.test(ch)) {
      num += ch;
    } else if (OPERATORS.includes(ch)) {
      if (num) {
        tokens.push(num);
        num = "";
      }
      tokens.push(ch);
    } else {
      return null;
    }
  }
  if (num) tokens.push(num);
  return tokens;
}

function evaluate(tokens: string[]): number | null {
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function parsePrimary(): number | null {
    const t = peek();
    if (t === undefined) return null;
    if (t === "(") {
      pos++;
      const v = parseExpression();
      if (v === null || peek() !== ")") return null;
      pos++;
      return v;
    }
    if (t === "-") {
      pos++;
      const v = parsePrimary();
      return v === null ? null : -v;
    }
    if (t === "+") {
      pos++;
      return parsePrimary();
    }
    if (/^\d+(\.\d+)?$/.test(t)) {
      pos++;
      return parseFloat(t);
    }
    return null;
  }

  function parseTerm(): number | null {
    let left = parsePrimary();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = peek();
      pos++;
      const right = parsePrimary();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) return null;
        left /= right;
      } else {
        left *= right;
      }
    }
    return left;
  }

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      pos++;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length || !isFinite(result)) return null;
  return Math.round(result * 1e9) / 1e9;
}

/**
 * Deteta "expressão = resultado" (ex.: "12*4+3 = 51").
 * Devolve not-calc se a mensagem não tiver esta forma.
 */
export function checkCalculation(message: string): CalcCheck {
  const match = message.match(/^(.+?)\s*=\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return { kind: "not-calc" };
  const tokens = tokenize(match[1]);
  if (!tokens || tokens.length === 0) return { kind: "not-calc" };
  const expected = evaluate(tokens);
  if (expected === null) return { kind: "not-calc" };
  const claimed = parseFloat(match[2].replace(",", "."));
  if (Math.abs(expected - claimed) < 1e-9) return { kind: "ok" };
  return { kind: "wrong", expected };
}

/** Mensagens de resposta (sem revelar o resultado certo quando está errado). */
export function calcFeedback(check: CalcCheck): string | null {
  if (check.kind === "not-calc") return null;
  if (check.kind === "ok") {
    return "✅ Conta certa! Confirmaste o teu cálculo — assim se estuda matemática!";
  }
  return "❌ Hmm, o resultado não bateu. Reconfere os teus passos: primeiro multiplicações e divisões, depois somas e subtrações. Tenta outra vez!";
}
