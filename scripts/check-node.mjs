// Confere o ambiente antes de rodar `npm run dev` / `npm run build`
// e mostra uma mensagem clara em português se algo estiver errado.
import { existsSync } from "node:fs";

const [major, minor] = process.versions.node.split(".").map(Number);
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;

if (!ok) {
  console.error(`
\u274C Versão do Node.js incompatível: você está usando ${process.versions.node}.
   O SunHost precisa do Node.js 20.19 ou superior (ou 22.12+).

   Como resolver:
   1) Baixe a versão LTS em https://nodejs.org
   2) Feche e abra o terminal de novo
   3) Confira com:  node -v
   4) Rode de novo:  npm install  e depois  npm run dev
`);
  process.exit(1);
}

if (!existsSync(new URL("../node_modules", import.meta.url))) {
  console.error(`
\u274C As dependências ainda não foram instaladas.
   Rode primeiro:  npm install
   Depois:         npm run dev
`);
  process.exit(1);
}
