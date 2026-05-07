import type { PrdTemplate } from '../types.js';

export const customerPortalTemplate: PrdTemplate = {
  id: 'builtin.customer_portal',
  name: 'Customer Portal / Self-Service',
  description:
    'Starter structure for customer-facing self-service portals. Emphasizes account management, support ticket workflows, order or subscription history, and reducing support team load.',
  category: 'customer_experience',
  builtIn: true,
  sectionStarters: {
    overview:
      'This customer portal enables customers to manage their account, access their history, and resolve common issues without contacting the support team. Core capabilities include account profile management, subscription or order history with detailed views, support ticket creation and tracking, a searchable knowledge base, and secure document access (invoices, contracts).',

    goals_and_success_metrics:
      'Common customer portal goals: reducing inbound support ticket volume by enabling self-service resolution, improving customer satisfaction by reducing wait times, increasing customer retention through better service transparency. Success metrics: self-service resolution rate (issues resolved without support agent contact), customer satisfaction score (post-interaction CSAT), support ticket deflection rate (knowledge base views before ticket creation), average ticket resolution time.',

    target_users_and_personas:
      "Typical customer portal personas: (1) Customer — the account holder accessing their own data; wants fast, clear information with minimal friction; uses the portal reactively when a problem arises or proactively to review billing; (2) Billing Contact — a different person in the customer organisation responsible for invoices and payment; may access only billing sections; (3) End User / Employee — an employee of the customer company using the product; may access support and documentation but not billing; (4) Support Agent — views the same portal the customer sees to assist with navigation; can create and update tickets on a customer's behalf.",

    user_stories:
      'Common customer portal user stories: customer logs in via SSO or email link and views their subscription status; customer downloads an invoice PDF; customer submits a support ticket with a description and screenshot attachment; customer searches the knowledge base before opening a ticket; customer receives an email notification when their ticket status changes; customer updates their billing contact email; support agent escalates a ticket to the engineering team; customer exports their data in response to a GDPR request.',

    functional_requirements:
      'Core customer portal functional areas: secure login with email/password and SSO (Google, Microsoft); account profile management (name, email, phone, billing address); subscription or order history with status badges and date filters; support ticket creation with category, description, and file attachment; ticket status tracking with activity timeline and agent comments; knowledge base with full-text search and category navigation; invoice and document download; notification preferences (email on ticket update, invoice available); data export for GDPR compliance.',

    non_functional_requirements:
      'Customer portal NFRs: login must complete within 2 seconds including SSO redirect; portal pages must load within 1.5 seconds at p95; must pass WCAG 2.1 AA accessibility audit; must support modern browsers (Chrome, Firefox, Safari, Edge — last 2 major versions); must be mobile-responsive with a functional experience on screens 375px wide and above; all customer data transmission must use TLS 1.2 or higher; session timeout after 30 minutes of inactivity.',

    constraints_and_assumptions:
      'Customer portal constraints: authentication integrates with the existing identity provider; a separate user database is not in scope. Customer data is read from the existing CRM and billing system via API; the portal does not store a copy of this data. File attachments for support tickets are limited to 10 MB per file and 50 MB per ticket. The portal is a web application only; native mobile apps are out of scope for v1. The knowledge base is managed by the support team through the admin backend.',

    out_of_scope:
      'Commonly out of scope for customer portal v1: native mobile applications, community forums and peer-to-peer support, live chat and chatbot integration, customer account provisioning (customers contact sales to add products), multi-language support beyond English, custom white-labelling per customer account, customer-to-customer data sharing, advanced reporting for customer admins.',

    open_questions:
      "Questions commonly left open at customer portal PRD stage: Should customers be able to manage multiple users under a single account (organisation-level access), or is the portal individual-account only? What is the expected knowledge base size — tens of articles (managed manually) or hundreds (requiring a CMS)? Should ticket attachments be stored indefinitely or purged after a retention period? Is SSO with the customer's own identity provider (BYOIDP) required?",

    risks_and_mitigations:
      'Customer portal risks: data accuracy — customers who see incorrect billing or subscription data will contact support anyway; mitigate with real-time API integration rather than cached copies, and clear "last updated" timestamps. Security — customer portals are high-value targets for credential stuffing and data exposure; mitigate with rate-limiting on login, MFA support, and regular penetration testing. Adoption — if customers don\'t know the portal exists, it won\'t deflect tickets; mitigate with a proactive launch campaign and portal links in all support email signatures.',
  },
};
