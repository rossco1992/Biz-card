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
    expectedEffect: "micromatch",
    reason: "Expo/Metro build tooling; upstream currently has no patched braces release for this advisory.",
  },
  "node-forge": {
    advisory: "GHSA-86w9-cpqp-85rv",
    expectedEffect: "@expo/code-signing-certificates",
    reason: "Expo code-signing build tooling; upstream currently has no patched node-forge release for this advisory.",
  },
};

const blocking = [];
const accepted = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  if (!["high", "critical"].includes(vulnerability.severity)) continue;

  const advisoryUrls = (vulnerability.via || [])
    .filter((item) => item && typeof item === "object" && typeof item.url === "string")
    .map((item) => item.url);
  const exception = exceptions[name];
  const exactAdvisory =
    exception &&
    advisoryUrls.length > 0 &&
    advisoryUrls.every((url) => url.includes(exception.advisory));
  const expectedPath =
    exception &&
    Array.isArray(vulnerability.effects) &&
    vulnerability.effects.includes(exception.expectedEffect);
  const indirect = vulnerability.isDirect !== true;

  if (exception && exactAdvisory && expectedPath && indirect) {
    accepted.push(`${name}: ${exception.advisory} — ${exception.reason}`);
  } else {
    blocking.push({
      name,
      severity: vulnerability.severity,
      advisories: advisoryUrls,
      effects: vulnerability.effects,
      isDirect: vulnerability.isDirect,
    });
  }
}

for (const item of accepted) {
  console.warn(`Accepted reviewed upstream build-tool exception: ${item}`);
}

if (blocking.length) {
  console.error("Unapproved high/critical production dependency findings:");
  for (const item of blocking) console.error(JSON.stringify(item));
  process.exit(1);
}

console.log("No unapproved high/critical production dependency vulnerabilities.");
