# Security Policy

PimSpace takes the security of UniformOrder and our users' data seriously. This document outlines our policy for reporting and handling potential security vulnerabilities.

---

## Supported Versions

Security updates and patches are actively applied to the following branch:

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main`           | :white_check_mark: |
| Legacy releases  | :x:                |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or public discussions.**

If you discover a security vulnerability in UniformOrder (including payment bypasses, multi-tenant isolation leaks, credential exposures, or auth bypasses), please disclose it to us privately using one of the following methods:

### 1. GitHub Security Advisories (Preferred)
Submit a private vulnerability report via [GitHub Security Advisories](https://github.com/qiaohaojie/uniform_order/security/advisories/new). This allows secure end-to-end communication directly within GitHub.

### 2. Email Disclosure
If GitHub Security Advisories are unavailable or you prefer email, send a detailed report to:
**`support@pimspace.com`**

Please include in your report:
- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- The affected component, API route, or tenant scope.
- Any suggested fixes or remediations (optional).

---

## Response & SLA

When you submit a private security report:
1. **Acknowledgment**: We aim to acknowledge receipt of your report within 24 to 48 hours.
2. **Assessment**: Our team will evaluate the impact and verify the vulnerability.
3. **Remediation**: If confirmed, we will prepare and deploy a fix to production promptly.
4. **Disclosure**: Once patched, we will coordinate public disclosure if appropriate and credit reporters who follow responsible disclosure practices.

---

## Security Architecture Highlights

UniformOrder implements multiple defense-in-depth security layers:
- **Tenant Isolation**: Strict route parameters and query filters validate tenant boundary (`imhs`, `rgsh`, etc.).
- **Stripe Connect Integrity**: PaymentIntents and Webhook signatures are verified server-side with strict idempotency checks.
- **Session & Auth Gating**: Operator routes require authenticated sessions matched against the tenant's `shop_email` or `PLATFORM_ADMIN_EMAILS`.
- **HTTP Security Headers**: Strict HSTS, CSP with per-request nonces, X-Frame-Options, and X-Content-Type-Options enforced via Next.js configuration.

Thank you for helping keep UniformOrder and PimSpace secure!
