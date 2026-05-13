const fs = require("fs");

let code1 = fs.readFileSync("app/api/local-brief/route.ts", "utf8");
code1 = code1.replace(
  `const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });`,
  `const apiKey = (process.env.GEMINI_API_KEY || "").trim();\nconst isDummyKey = !apiKey || apiKey.includes("your_actual");\nconst ai = !isDummyKey ? new GoogleGenAI({ apiKey }) : null;`
);
code1 = code1.replace(
  `  try {\n    const newsContext = news.length > 0`,
  `  try {\n    if (!ai) throw new Error("GEMINI_API_KEY is missing or invalid.");\n    const newsContext = news.length > 0`
);
fs.writeFileSync("app/api/local-brief/route.ts", code1);

let code2 = fs.readFileSync("app/api/rag/route.ts", "utf8");
code2 = code2.replace(
  `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });`,
  `const apiKey = (process.env.GEMINI_API_KEY || "").trim();\nconst isDummyKey = !apiKey || apiKey.includes("your_actual");\nconst ai = !isDummyKey ? new GoogleGenAI({ apiKey }) : null;`
);
code2 = code2.replace(
  `    // ── Gemini call ───────────────────────────────────────────────────────────\n    const result = await ai.models.generateContent({`,
  `    // ── Gemini call ───────────────────────────────────────────────────────────\n    if (!ai) throw new Error("GEMINI_API_KEY is missing or invalid.");\n    const result = await ai.models.generateContent({`
);
fs.writeFileSync("app/api/rag/route.ts", code2);
console.log("Fixed both files");
