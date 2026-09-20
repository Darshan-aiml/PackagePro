import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Give every test run its own throwaway write store so planFor()/bookings never
// touch the real data/packagepro.db. The given PS-04.db stays read-only.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "packagepro-test-"));
process.env.PACKAGEPRO_DATA_DIR = dir;