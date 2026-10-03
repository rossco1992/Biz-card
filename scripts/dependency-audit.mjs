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

const reviewedRoots = {
  braces: {
    advisory: "GHSA-vfj7-8cjw-p6xm",
    reason: "Expo/Metro build tooling; upstream currently has no patched braces release for this advisory.",
  },
  "node-forge": {
    advisory: "GHSA-86w9-cpqp-85rv",
    reason: "Expo code-signing build tooling; upstream currently has no patched node-forge release for this advisory.",
  },
};

const vulnerabilities = report.vulnerabilities || {};

function isHigh(severity) {
  return severity === "high" || severity === "critical";
}

function directHighAdvisories(name) {
  const vulnerability = vulnerabilities[name];
  return (vulnerability?.via || []).filter(
    (item) => item && typeof item === "object" && isHigh(item.severity),
  );
}

function dependencyRefs(name) {
  const vulnerability = vulnerabilities[name];
  return (vulnerability?.via || []).filter((item) => typeof item === "string");
}

/**
 * npm propagates severity upward: Expo/React Native/Metro can all be labelled
 * "high" because of one advisory several dependencies below. Walk that graph
 * and judge the actual high/critical advisory roots instead of allowlisting
 * every parent package name. Cycles in Metro's graph are harmless here because
 * visited nodes are not revisited.
 */
function highAdvisoryRoots(start) {
  const roots = [];
  const visited = new Set();

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);

    for (const advisory of directHighAdvisories(name)) {
      roots.push({
        package: name,
        url: typeof advisory.url === "string" ? advisory.url : "",
        severity: advisory.severity,
      });
    }

    for (const dependency of dependencyRefs(name)) {
      if (vulnerabilities[dependency]) visit(dependency);
    }
  }

  visit(start);
  return roots;
}

function isReviewedRoot(root) {
  const reviewed = reviewedRoots[root.package];
  return Boolean(
    reviewed &&
    root.url &&
    root.url.includes(reviewed.advisory),
  );
}

const blocking = [];
const acceptedParents = [];
const acceptedRootNames = new Set();

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!isHigh(vulnerability.severity)) continue;

  const roots = highAdvisoryRoots(name);
  const approved = roots.length > 0 && roots.every(isReviewedRoot);

  if (approved) {
    for (const root of roots) acceptedRootNames.add(root.package);
    if (!reviewedRoots[name]) acceptedParents.push(name);
    continue;
  }

  blocking.push({
    name,
    severity: vulnerability.severity,
    highAdvisoryRoots: roots,
    via: vulnerability.via,
  });
}

for (const name of [...acceptedRootNames].sort()) {
  const reviewed = reviewedRoots[name];
  console.warn(
    `Accepted reviewed upstream build-tool exception: ${name}: ${reviewed.advisory} — ${reviewed.reason}`,
  );
}

if (acceptedParents.length) {
  console.warn(
    `Accepted only inherited severity from reviewed roots: ${[...new Set(acceptedParents)].sort().join(", ")}`,
  );
}

if (blocking.length) {
  console.error("Unapproved high/critical production dependency findings:");
  for (const item of blocking) console.error(JSON.stringify(item));
  process.exit(1);
}

console.log("No unapproved high/critical production dependency vulnerabilities.");
