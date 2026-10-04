import "@testing-library/jest-dom/vitest";

// The public repo ships no .env.local. Tests mock every Anthropic call, but
// lib/env.ts validates that a key is present at import time, so provide a
// placeholder when none is configured.
process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-placeholder";
