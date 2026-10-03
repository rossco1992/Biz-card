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
    reason: "Expo/Metro build tooling; upstream advisory currently lists no patched braces version.",
  },
  "node-forge": {
    advisory: "GHSA-86w9-cpqp-85rv",
    expectedEffect: "@expo/code-signing-certificates",
    reason: "Expo code-signing build tooling; upstream advisory currently lists no patched node-forge version.",
  },
};

const vulnerabilities = report.vulnerabilities || {};
const acceptedRoots = new Set();
const memo = new Map();

function auditObjects(vulnerability) {
  return (vulnerability?.via || []).filter(
    (item) => item && typeof item === "object",
  );
}

function inheritedDependencies(vulnerability) {
  return (vulnerability?.via || []).filter(
    (item) => typeof item === "string",
  );
}

function approvedByReviewedUpstreamChain(name, stack = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (stack.has(name)) return false;

  const vulnerability = vulnerabilities[name];
  if (!vulnerability || !["high", "critical"].includes(vulnerability.severity)) {
    return false;
  }

  const exception = exceptions[name];
  const direct = auditObjects(vulnerability);
  const inherited = inheritedDependencies(vulnerability);

  if (exception) {
    const urls = direct
      .map((item) => item.url)
      .filter((url) => typeof url === "string");
    const exactAdvisory =
      direct.length > 0 &&
      urls.length === direct.length &&
      urls.every((url) => url.includes(exception.advisory));
    const expectedPath =
      Array.isArray(vulnerability.effects) &&
      vulnerability.effects.includes(exception.expectedEffect);

    const approved = exactAdvisory && expectedPath;
    memo.set(name, approved);
    if (approved) acceptedRoots.add(name);
    return approved;
  }

  // Never suppress a package that has its own advisory object. Only packages
  // whose severity is inherited entirely from an approved dependency chain
  // may inherit the reviewed exception.
  if (direct.length > 0 || inherited.length === 0) {
    memo.set(name, false);
    return false;
  }

  const nextStack = new Set(stack);
  nextStack.add(name);
  const approved = inherited.every((dependency) =>
    approvedByReviewedUpstreamChain(dependency, nextStack),
  );
  memo.set(name, approved);
  return approved;
}

const blocking = [];
const inheritedAccepted = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!["high", "critical"].includes(vulnerability.severity)) continue;

  if (approvedByReviewedUpstreamChain(name)) {
    if (!exceptions[name]) inheritedAccepted.push(name);
    continue;
  }

  blocking.push({
    name,
    severity: vulnerability.severity,
    via: vulnerability.via,
    effects: vulnerability.effects,
    isDirect: vulnerability.isDirect,
  });
}

for (const name of acceptedRoots) {
  const exception = exceptions[name];
  console.warn(
    `Accepted reviewed upstream build-tool exception: ${name}: ${exception.advisory} — ${exception.reason}`,
  );
}
if (inheritedAccepted.length) {
  console.warn(
    `Accepted only inherited severity from reviewed build-tool chains: ${inheritedAccepted.sort().join(", ")}`,
  );
}

if (blocking.length) {
  console.error("Unapproved high/critical production dependency findings:");
  for (const item of blocking) console.error(JSON.stringify(item));
  process.exit(1);
}

console.log("No unapproved high/critical production dependency vulnerabilities.");
