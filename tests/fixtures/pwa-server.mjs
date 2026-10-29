// Servidor de teste: simula builds A/B e instalação incompleta, sem alterar a aplicação.
import http from "node:http";
import { readFile } from "node:fs/promises";
let version = "A",
  broken = false,
  failed = 0;
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:3177");
      if (url.pathname === "/__version" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const next = JSON.parse(body);
        version = next.version;
        broken = !!next.broken;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ version, broken, failed }));
        return;
      }
      if (url.pathname === "/__status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ version, broken, failed }));
        return;
      }
      if (url.pathname === "/sw.js") {
        const source = (await readFile("public/sw.js", "utf8")).replace(
          /const BUILD_ID = "[^"]+";/,
          'const BUILD_ID = "fixture-' + version + '";',
        );
        res.writeHead(200, {
          "Content-Type": "text/javascript",
          "Cache-Control": "no-store",
        });
        res.end(source);
        return;
      }
      if (
        broken &&
        url.pathname.startsWith("/_next/static/") &&
        url.pathname.endsWith(".js")
      ) {
        failed++;
        res.writeHead(503);
        res.end("incomplete fixture");
        return;
      }
      const response = await fetch("http://127.0.0.1:3176" + req.url);
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      res.writeHead(response.status, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      });
      if (contentType.includes("text/html"))
        res.end(
          (await response.text()).replace(
            "<html",
            "<!-- VERSION_" + version + " --><html",
          ),
        );
      else res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end("Fixture failed");
    }
  })
  .listen(3177, "127.0.0.1");
