import type { PrdTemplate } from '../types.js';

export const eCommerceTemplate: PrdTemplate = {
  id: 'builtin.e_commerce',
  name: 'E-Commerce / Online Store',
  description:
    'Starter structure for e-commerce and online retail applications. Emphasizes product catalog, shopping cart, checkout flow, payment processing, and order management.',
  category: 'e_commerce',
  builtIn: true,
  sectionStarters: {
    overview:
      'This e-commerce platform enables merchants to sell products online with a full buyer journey from product discovery to order delivery. Core capabilities include a product catalog with categories and variants, a shopping cart and multi-step checkout, integrated payment processing, order management and fulfilment tracking, inventory management, and a merchant admin panel for catalogue and order management.',

    goals_and_success_metrics:
      'Common e-commerce goals: achieving a target conversion rate from product view to completed purchase, minimising cart abandonment through a streamlined checkout experience, enabling merchants to list and manage products without technical assistance, and providing buyers with order transparency post-purchase. Success metrics: checkout conversion rate, cart abandonment rate, average order value, payment failure rate, percentage of orders processed without manual intervention, page load time for product listing and product detail pages.',

    target_users_and_personas:
      "Typical e-commerce personas: (1) Shopper — browses and purchases products; expects fast search, clear product information, and a frictionless checkout; may be a repeat buyer or first-time visitor; (2) Guest Shopper — completes a purchase without creating an account; values speed over personalisation; (3) Merchant / Store Owner — manages the product catalogue, processes orders, sets prices and promotions; moderate technical proficiency; uses the admin panel daily; (4) Merchant Administrator — manages user accounts for the merchant's team, configures payment and shipping settings, runs financial reports; (5) Customer Service Agent — looks up order status on behalf of customers, processes returns and refunds.",

    user_stories:
      'Common e-commerce user stories: shopper searches for a product by keyword and filters by price range and category; shopper views product detail page with multiple images, variant selector (size, colour), and stock availability; shopper adds to cart and proceeds to checkout; guest shopper completes checkout with email only (no account required); registered shopper checks out with saved address and payment method; merchant adds a new product with images, variants, and pricing; merchant processes a pending order and marks it as shipped with a tracking number; customer service agent issues a partial refund for a returned item.',

    functional_requirements:
      'Core e-commerce functional areas: product catalogue with categories, subcategories, and tags; product variants (size, colour, etc.) with per-variant pricing and stock levels; product search with keyword, category, and attribute filters; product image gallery with zoom; shopping cart with quantity adjustments and save-for-later; guest checkout with email address; registered account checkout with saved addresses; payment processing via Stripe (cards) and PayPal; order confirmation email to buyer; order management in merchant admin (list, filter by status, view detail, update status); inventory tracking with low-stock alerts; coupon / discount code support; tax calculation based on shipping address; shipping rate configuration by weight and destination zone.',

    non_functional_requirements:
      "E-commerce NFRs: product listing page must load within 1.5 seconds at p95; product detail page must load within 1 second at p95; checkout flow must complete a payment transaction within 5 seconds of submission; the system must handle 500 concurrent shoppers without degradation; payment processing must meet PCI DSS SAQ A requirements (payment data never touches the platform's servers — Stripe.js handles card data); all customer PII must be encrypted at rest; order data must be retained for 7 years for financial compliance.",

    constraints_and_assumptions:
      "E-commerce constraints: payment processing uses Stripe as the primary provider and PayPal as an alternative; no other payment methods in v1. Tax calculation uses a third-party tax API (TaxJar or Avalara); the platform does not implement its own tax rules. Shipping rate tables are configured statically in the admin panel; real-time carrier rate lookups (FedEx, UPS APIs) are out of scope for v1. Product images are stored in the platform's asset storage; no CDN integration in v1 (can be added via CDN configuration at the infrastructure level).",

    out_of_scope:
      'Commonly out of scope for e-commerce v1: subscription / recurring billing, digital downloads (ebooks, software licences), marketplace model (multiple independent sellers), native mobile apps, loyalty points / rewards program, product reviews and ratings, wish lists, back-in-stock notifications, abandoned cart email recovery, multi-currency pricing, international shipping with customs declarations, dropshipping integrations.',

    open_questions:
      'Questions commonly left open at e-commerce PRD stage: Should guest checkout be available, or is account creation required? What is the return and refund policy, and how automated should the refund process be? Are there physical products only, or also digital products? What is the expected product catalogue size — hundreds or tens of thousands of SKUs (affects search and browse UX significantly)?',

    risks_and_mitigations:
      'E-commerce risks: payment failures — payment errors at checkout directly cost revenue; mitigate with clear error messages, retry prompts, and a fallback payment method. Inventory overselling — two shoppers purchasing the last item simultaneously; mitigate with database-level inventory reservation at cart add and atomic decrement at order confirmation. Cart abandonment — long or confusing checkout increases abandonment; mitigate with a single-page checkout design, guest checkout option, and progress indicator. Fraud — e-commerce platforms attract fraudulent orders; mitigate with Stripe Radar rules, CVV and address verification, and manual review queue for high-value orders.',
  },
};
