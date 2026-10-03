import { spawnSync } from "node:child_process";

const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(audit.stdout || "{}");
} catch {
  console.error("Dependency audit did not return valid JSON.");
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(1);
}

const exceptions = {
  braces: {
    advisory: "GHSA-vfj7-8cjw-p6xm",
    effect: "micromatch",
    reason: "Expo/Metro build tooling; upstream advisory currently lists no patched braces version.",
  },
  "node-forge": {
    advisory: "GHSA-86w9-cpqp-85rv",
    effect: "@expo/code-signing-certificates",
    reason: "Expo code-signing build tooling; upstream advisory currently lists no patched node-forge version.",
  },
};

const blocking = [];
const accepted = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  if (!["high", "critical"].includes(vulnerability.severity)) continue;

  const urls = (vulnerability.via || [])
    .filter((item) => item && typeof item === "object" && typeof item.url === "string")
    .map((item) => item.url);
  const exception = exceptions[name];
  const exactAdvisory = exception
    && urls.length > 0
    && urls.every((url) => url.includes(exception.advisory));
  const expectedBuildPath = exception
    && Array.isArray(vulnerability.effects)
    && vulnerability.effects.includes(exception.effect);
  const indirect = vulnerability.isDirect !== true;

  if (exception && exactAdvisory && expectedBuildPath && indirect) {
    accepted.push(`${name}: ${exception.advisory} — ${exception.reason}`);
  } else {
    blocking.push({ name, severity: vulnerability.severity, via: urls, effects: vulnerability.effects });
  }
}

for (const item of accepted) console.warn(`Accepted upstream build-tool exception: ${item}`);

if (blocking.length) {
  console.error("Unapproved high/critical production dependency findings:");
  for (const item of blocking) console.error(JSON.stringify(item));
  process.exit(1);
}

console.log("No unapproved high/critical production dependency vulnerabilities.");
