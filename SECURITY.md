# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Solidify seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them through one of the following channels:

1. **GitHub Security Advisories** (Preferred): Use the [GitHub Security Advisory](https://github.com/garbin/solidify/security/advisories/new) feature to privately report a vulnerability.

2. **Email**: Send an email to [garbinh@gmail.com](mailto:garbinh@gmail.com) with the subject line "Security Vulnerability Report: Solidify".

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Status Update**: We will provide a status update within 7 days.
- **Resolution**: We will work to fix the vulnerability and release a patch as soon as possible, depending on the severity and complexity.

### Disclosure Policy

- We ask that you give us a reasonable amount of time to fix the vulnerability before disclosing it publicly.
- We will credit you for the discovery (unless you prefer to remain anonymous).
- We will publish a security advisory on GitHub once the fix is released.

## Security Best Practices

When using Solidify, please follow these security best practices:

1. **Keep dependencies updated**: Regularly run `npm audit` and update dependencies.
2. **Validate input**: Always validate user input before processing.
3. **Use parameterized queries**: Solidify uses Knex/Objection.js which provides parameterized queries by default.
4. **Protect sensitive data**: Never expose internal error details to end users.
5. **Use HTTPS**: Always use HTTPS in production environments.
6. **Implement proper authentication and authorization**: Solidify does not include built-in auth; integrate appropriate authentication mechanisms.

## Known Security Considerations

### SQL Injection

Solidify uses Objection.js and Knex.js for database operations, which use parameterized queries by default. However:

- Be cautious when using `orderByRaw` with user input
- Avoid string concatenation in raw queries
- Always validate and sanitize user input

### GraphQL

- The `graphql.presets.search` resolver validates sortable fields against a whitelist
- Be careful when exposing GraphQL schemas to public APIs
- Consider implementing query depth limits and rate limiting

## Security Updates

Security updates will be released as patch versions and announced through:

- GitHub Security Advisories
- GitHub Releases
- npm package updates

Thank you for helping keep Solidify and its users safe!
