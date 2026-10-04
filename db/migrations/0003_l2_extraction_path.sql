-- Records which L2 extraction path produced each abstract: "text" for the
-- text-native path (unpdf + Sonnet 4.6) or "vision" for the scanned path
-- (Opus 4.7 native PDF). Surfaced in the UI as a transparency badge.
ALTER TABLE `lease_abstracts` ADD `extraction_path` text;
