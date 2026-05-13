const fs = require('fs');
let code = fs.readFileSync('app/welcome/page.tsx', 'utf8');

if (!code.includes('interface ConciergeData')) {
    const importMatch = code.match(/interface HistoryEntry \{[\s\S]*?\n\}/);
    if (importMatch) {
        code = code.replace(importMatch[0], importMatch[0] + '\n\ninterface ConciergeData {\n  title: string;\n  message: string;\n  userName: string | null;\n  needsInitialization?: boolean;\n  tags?: string[];\n  defaultLocation?: string;\n}');
    }
}

if (!code.includes('const [concierge, setConcierge] = useState')) {
    code = code.replace(
        'const [active, setActive]     = useState<ActiveSection>(null);',
        'const [active, setActive]     = useState<ActiveSection>(null);\n  const [concierge, setConcierge] = useState<ConciergeData | null>(null);'
    );
}

const oldTryBlock = /try \{\s*const res = await fetch\("\/api\/events", \{ headers: \{ Authorization: Bearer \$\{token\} \} \}\);\s*if \(res\.ok\) \{\s*const data = await res\.json\(\) as \{ history: HistoryEntry \| null \};\s*if \(data\.history && data\.history\.events\.length > 0\) setHistory\(data\.history\);\s*\}\s*\} catch/;
if (oldTryBlock.test(code)) {
    const newTryBlock = 	ry {
        const [evRes, concRes] = await Promise.all([
          fetch("/api/events", { headers: { Authorization: "Bearer " + token } }),
          fetch("/api/travel-agent", { headers: { Authorization: "Bearer " + token } })
        ]);

        if (evRes.ok) {
          const data = await evRes.json() as { history: HistoryEntry | null };
          if (data.history && data.history.events.length > 0) setHistory(data.history);
        }
        
        if (concRes.ok) {
          const concData = await concRes.json() as ConciergeData;
          setConcierge(concData);
          if (concData.defaultLocation) {
             fetch("/api/city", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ city: concData.defaultLocation }) })
               .then(r => r.json())
               .then(cData => { if (cData.city) setCityData(cData); })
               .catch(() => {});
          }
        }
      } catch;
    code = code.replace(oldTryBlock, newTryBlock);
}

const oldRequestLocation = /if \(evRes\.ok\) \{\s*const data = await evRes\.json\(\) as \{ city\?: string; events\?: SerpEvent\[\] \};\s*setCity\(data\.city \?\? null\);\s*setEvents\(\(data\.events \?\? \[\]\)\.slice\(0, 4\)\);\s*\}\s*if \(cityRes\.ok\) \{\s*setCityData\(await cityRes\.json\(\) as CityData\);\s*\}\s*setLocState\("done"\);/;
if (oldRequestLocation.test(code)) {
    const newRequestLocation = let resolvedCity = null;
            if (evRes.ok) {
              const data = await evRes.json() as { city?: string; events?: SerpEvent[] };
              setCity(data.city ?? null);
              setEvents((data.events ?? []).slice(0, 4));
              resolvedCity = data.city;
            }
            if (cityRes.ok) {
              const cData = await cityRes.json() as CityData;
              setCityData(cData);
              if (!resolvedCity) resolvedCity = cData.city;
            }
            
            if (resolvedCity) {
              await fetch("/api/travel-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
                body: JSON.stringify({ defaultLocation: resolvedCity })
              });
              
              try {
                const concRes = await fetch("/api/travel-agent", { headers: { Authorization: "Bearer " + idToken } });
                if (concRes.ok) {
                  const concData = await concRes.json() as ConciergeData;
                  setConcierge(concData);
                }
              } catch {}
            }
            
            setLocState("done");;
    code = code.replace(oldRequestLocation, newRequestLocation);
}

const oldHeader = /\{\/\* Header \*\/\}\s*<motion\.div\s*initial=\{\{ opacity: 0, y: 10 \}\} animate=\{\{ opacity: 1, y: 0 \}\}\s*transition=\{\{ duration: 0\.45, ease \}\} className="mb-8"\s*>\s*<p className="text-xs font-medium tracking-\[0\.12em\] uppercase text-gray-400 mb-1\.5">Raconteur<\/p>\s*<h1 className="text-\[1\.85rem\] font-semibold tracking-tight leading-tight text-\[#1d1d1f\]">\s*What are you<br \/>looking for\?\s*<\/h1>\s*<\/motion\.div>/;
if (oldHeader.test(code)) {
    const newHeader = {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease }} className="mb-8"
            >
              <p className="text-xs font-medium tracking-[0.12em] uppercase text-gray-400 mb-1.5">
                {concierge?.userName ? "Welcome, " + concierge.userName : "Raconteur"}
              </p>
              <h1 className="text-[1.85rem] font-semibold tracking-tight leading-tight text-[#1d1d1f] mb-3">
                {concierge?.title || "What are you looking for?"}
              </h1>
              {concierge?.message && (
                <p className="text-[15px] leading-relaxed text-gray-500">
                  {concierge.message.replace(concierge.title || "", "").trim() || concierge.message}
                </p>
              )}
            </motion.div>;
    code = code.replace(oldHeader, newHeader);
}

const oldTiles = /<div className="flex flex-col gap-3">\s*<div className="grid grid-cols-2 gap-3">\s*<HomeTile[\s\S]*?<\/svg>\s*\}\s*\/>\s*<\/div>\s*<CityTile/;
if (oldTiles.test(code)) {
    const matched = code.match(oldTiles)[0];
    const wrapped = matched.replace('<div className="grid grid-cols-2 gap-3">', '{(!concierge || !concierge.needsInitialization) && (<div className="grid grid-cols-2 gap-3">')
                           .replace('</div>\n              <CityTile', '</div>)}\n              <CityTile');
    code = code.replace(oldTiles, wrapped);
}

fs.writeFileSync('app/welcome/page.tsx', code);
