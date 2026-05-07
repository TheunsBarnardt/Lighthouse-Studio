import type { PrdTemplate } from '../types.js';

export const blogTemplate: PrdTemplate = {
  id: 'builtin.blog',
  name: 'Blog / Content Publishing',
  description:
    'Starter structure for blog and content publishing platforms. Emphasizes the content creation workflow, editorial review, reader experience, and SEO.',
  category: 'content_publishing',
  builtIn: true,
  sectionStarters: {
    overview:
      'This publishing platform enables teams to create, edit, review, and publish content for web audiences. Core capabilities include a rich text editor with media embedding, a category and tagging taxonomy, an editorial workflow with draft/review/publish states, comment moderation, SEO metadata management, and an RSS feed.',

    goals_and_success_metrics:
      'Common blog platform goals: increasing content publishing frequency by reducing time-to-publish, improving organic search traffic through better SEO tooling, increasing reader engagement through comments and related content, enabling non-technical authors to publish without developer assistance. Success metrics: average time from draft creation to publish, monthly organic search impressions, comment engagement rate, percentage of posts with complete SEO metadata.',

    target_users_and_personas:
      'Typical publishing platform personas: (1) Author — writes content, manages own drafts, submits for review; may be non-technical; uses the editor daily; (2) Editor / Content Manager — reviews and approves author submissions, manages the editorial calendar, sets category and tag structure; (3) Administrator — manages user accounts and permissions, configures site settings, monitors comments for policy violations; (4) Reader — consumes published content, may leave comments; (5) SEO Specialist — reviews content before publish for SEO completeness, manages redirects and metadata.',

    user_stories:
      'Common publishing user stories: author creates a new post with rich text, images, and embedded video; editor receives a notification when a post is submitted for review; editor requests revisions with inline comments; author revises and resubmits; editor publishes with a scheduled publish date; SEO specialist adds meta description and canonical URL before publish; admin moderates reader comments and approves or rejects.',

    functional_requirements:
      'Core publishing functional areas: rich text editor with support for headings, bold/italic, links, images (with upload), embedded video, code blocks, and tables; draft auto-save; version history per post; category assignment (single) and tag assignment (multiple); SEO metadata fields (title, meta description, canonical URL, Open Graph image); publish scheduling; comment submission with email verification; comment moderation queue; RSS feed generation; post search; related posts by tag.',

    non_functional_requirements:
      'Publishing platform NFRs: post editor must auto-save within 2 seconds of inactivity; published post page must load within 1 second at p95 (excluding images); rich text editor must support posts up to 50,000 words without performance degradation; comment spam filtering must process new comments within 5 seconds; RSS feed must reflect new posts within 60 seconds of publish.',

    constraints_and_assumptions:
      "Publishing platform constraints: initial version supports a single language and locale; multi-language and translation workflows are future phases. Image storage uses the platform's asset storage; no CDN integration in v1. Assumes the host environment provides SMTP for author and reader email notifications. Comments do not require account creation in v1 (email verification only).",

    out_of_scope:
      'Commonly out of scope for publishing v1: multi-language content, paid subscription / paywalled content, newsletter delivery (email campaigns), podcast hosting, native mobile app, full-text search across all content, A/B testing for headlines, advertising / ad placement, custom domains per publication, social media scheduling integration.',

    open_questions:
      'Questions commonly left open at publishing PRD stage: Should authors be able to collaborate in real-time on a single draft, or is concurrent editing out of scope? What is the comment moderation policy — approve-all vs. approve-first for new commenters? Should SEO metadata completion be required before publish, or advisory only? Should category assignment be single or multiple?',

    risks_and_mitigations:
      'Publishing platform risks: content loss — authors expect zero data loss from the editor; mitigate with aggressive auto-save, local draft backup, and a visible "saved" indicator. SEO regressions — changing URL structures after publish breaks inbound links; mitigate with automatic redirect creation on slug change. Comment spam — open comment systems attract spam at scale; mitigate with email verification, honeypot fields, and Akismet integration.',
  },
};
