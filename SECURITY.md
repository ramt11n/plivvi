# Security reports

Report a potential vulnerability privately to [ramtinneshat4@gmail.com](mailto:ramtinneshat4@gmail.com), with the affected version, reproduction steps, and a synthetic sample if needed. Avoid putting credentials or private documents in public issues. There is no paid bug-bounty program or guaranteed response time.

PDF JavaScript is disabled. Cloud tokens stay in session memory, authentication uses the providers’ official browser SDKs, and the public application contains no admin secrets. Those design choices are not a guarantee that software has no vulnerabilities.

Dependency advisories are reviewed for the code paths actually used in the browser. The Node-only `image-size` dependency of PPTX export currently has reported malformed-image parser advisories; the browser package stubs it and Pocket supplies its own generated JPEG page images. Do not reuse this application as an untrusted server-side conversion service without a separate dependency and resource-limit review.
