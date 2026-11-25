import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_DOMAIN } from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

/**
 * Dearm Privacy Policy, English edition.
 *
 * The facts in here (fields collected, sub-processors used, cookie names) must
 * match the implementation. Update this file whenever the schema changes, a
 * provider is swapped or a cookie is added — a privacy policy that disagrees
 * with the code is worse than none.
 */
export const privacyPolicyEn: LegalDocument = {
  title: "Dearm Privacy Policy",
  effectiveDate: "9 August 2026",
  intro: [
    {
      kind: "paragraph",
      text: "Welcome to Dearm. We know how much your personal information matters, and your trust matters to us. This Privacy Policy (the “Policy”) explains how we collect, use, share, store and protect your personal information while you use the Service, and how you can manage that information.",
    },
    {
      kind: "notice",
      title: "The short version",
      items: [
        "We collect only what running the Service requires: an email address, the content you create yourself, and the technical logs we need.",
        "We never use your conversations, characters or any other content to train AI models, and we never sell your personal information.",
        "You can export or delete your content, or close your account, at any time.",
      ],
    },
    {
      kind: "paragraph",
      text: "Please read this Policy, and in particular the clauses shown in bold, before you start using our products and services. If you have questions, comments or suggestions, contact us using the details at the end of this Policy.",
    },
  ],
  sections: [
    {
      id: "definitions",
      heading: "1. Definitions and scope",
      blocks: [
        { kind: "subheading", text: "1.1 Definitions" },
        {
          kind: "list",
          items: [
            `Dearm: the AI character chat and interactive storytelling platform operated by a sole developer based in Japan (“we”, “us”) at ${LEGAL_SITE_DOMAIN}. For the purposes of the EU General Data Protection Regulation (GDPR) we are the data controller.`,
            "Personal information: information recorded electronically or otherwise that relates to an identified or identifiable natural person, excluding anonymised information.",
            "Usage data: data generated or collected automatically when you use the Service, including technical logs and device information.",
            "Service provider: any natural or legal person that processes data on our behalf, helping us run the Service, analyse its use or perform other related functions.",
            "You: the individual accessing or using the Service, or the company or other legal entity on whose behalf that individual acts.",
          ],
        },
        {
          kind: "paragraph",
          text: "Unless stated otherwise, terms used in this Policy have the same meaning as in the Terms of Service.",
        },
        { kind: "subheading", text: "1.2 Scope" },
        {
          kind: "paragraph",
          text: "This Policy applies to all products and services Dearm provides to you. It does not apply to services a third party provides to you independently — those are governed by that third party's own privacy policy.",
        },
      ],
    },
    {
      id: "collect",
      heading: "2. What we collect and why",
      blocks: [
        {
          kind: "paragraph",
          text: "We process your personal information only to provide the Service to you and to meet our legal obligations in doing so. We currently process it for no other purpose. The specific situations are set out below.",
        },
        { kind: "subheading", text: "2.1 Creating your account" },
        {
          kind: "paragraph",
          text: "To create a Dearm account you must give us an email address and set a password. Passwords are stored as a one-way hash, so we cannot recover your original password. If you decline to provide this information you cannot register or use the Service.",
        },
        {
          kind: "paragraph",
          text: "You may optionally add a display name, username, avatar and bio. These appear on your profile and on the works you publish, and other users can see them.",
        },
        { kind: "subheading", text: "2.2 Providing core features" },
        {
          kind: "paragraph",
          text: "As you use the Service we store the content you create, including:",
        },
        {
          kind: "list",
          items: [
            "character cards and their settings fields;",
            "beautification packs and regex rules;",
            "sessions and message history, and the debug information generated when you turn on debug mode;",
            "images you upload (avatars, cover images, reference images);",
            "your favourites, follows and preferences.",
          ],
        },
        {
          kind: "paragraph",
          strong: true,
          text: "Please note: whether you put personal information into a conversation, and what you put there, is entirely your decision. We do not recommend entering real names, contact details, identity document numbers, biometric data, or health or financial information into conversations, and you should not provide anyone else's personal information without their authorisation.",
        },
        { kind: "subheading", text: "2.3 Paid features" },
        {
          kind: "paragraph",
          text: "When you buy a monthly pass, Stripe handles the payment flow. We record the order reference, amount, currency, tier and payment status for fulfilment and reconciliation.",
        },
        {
          kind: "paragraph",
          strong: true,
          text: "We never see, receive or store your full card number, expiry date or security code. Stripe handles those directly.",
        },
        {
          kind: "subheading",
          text: "2.4 Keeping the Service secure and stable",
        },
        {
          kind: "paragraph",
          text: "While you use the Service we automatically collect the technical logs we need, including IP address, browser type and version, operating system, time of access and pages accessed, and error diagnostics. We use these to investigate faults, prevent abuse and attacks, and plan capacity.",
        },
        { kind: "subheading", text: "2.5 Support and disputes" },
        {
          kind: "paragraph",
          text: "When you contact us or raise a dispute, we keep a record of our correspondence and its contents so that we can verify your identity, handle your issue and record the outcome.",
        },
        { kind: "subheading", text: "2.6 Where consent is not required" },
        {
          kind: "paragraph",
          text: "Under applicable law we may process your personal information without separate consent where: it is necessary to enter into or perform a contract to which you are a party; it is necessary to meet a legal obligation; it is necessary in an emergency to protect a natural person's life, health or property; the information is one you have made public yourself or that is already lawfully public; or the law otherwise so provides.",
        },
        { kind: "subheading", text: "2.7 Anonymisation and statistics" },
        {
          kind: "paragraph",
          text: "We may irreversibly anonymise the information we collect and use it for statistical analysis and capacity planning. Such data can no longer identify any individual and is no longer personal information.",
        },
        {
          kind: "paragraph",
          strong: true,
          text: "Even so, we will not use your anonymised conversation content for any machine learning or model training purpose. See section 4.",
        },
      ],
    },
    {
      id: "cookies",
      heading: "3. Cookies and local storage",
      blocks: [
        {
          kind: "paragraph",
          text: "The Service is a pure web application, and we use a small number of cookies and browser local storage to keep it working. We serve no advertising and use no third-party advertising trackers or cross-site analytics cookies.",
        },
        {
          kind: "list",
          items: [
            "Session cookie: written by the authentication service to keep you signed in. Clearing it signs you out.",
            "nj_locale: records the interface language you chose.",
            "nj_show_nsfw: records your NSFW display preference on the explore page.",
            "Local storage: holds drafts and interface preferences that do not identify you.",
          ],
        },
        {
          kind: "paragraph",
          text: "You can clear or block cookies through your browser at any time, but clearing the session cookie will sign you out. We honour the browser “Do Not Track” signal — since we do no cross-site tracking in the first place, the signal makes no additional difference here.",
        },
      ],
    },
    {
      id: "ai-processing",
      heading: "4. AI processing and the training red line",
      blocks: [
        { kind: "subheading", text: "4.1 How a conversation is processed" },
        {
          kind: "paragraph",
          text: "When you start an AI conversation, we send the content that conversation requires — the character card settings, the message history and your input — to a third-party AI model provider, which generates the reply. We send only what is needed to produce that reply, and we do not attach your account identifiers.",
        },
        { kind: "subheading", text: "4.2 The training red line" },
        {
          kind: "notice",
          title: "Our model training commitment",
          items: [
            "We will never, under any circumstances, use your inputs, your outputs, your conversations, your characters or your stories to train, fine-tune or evaluate any AI model, or for any other machine learning purpose.",
            "Not our own models, not a partner's models, not a third party's models. There is no exception to this.",
            "When we choose a model provider, it is a hard requirement that its API terms expressly exclude using API data to train models.",
          ],
        },
        { kind: "subheading", text: "4.3 Prompt assets" },
        {
          kind: "paragraph",
          text: "The prompt fields in a creator's character card are protected by section 5 of the Terms of Service. Other than showing them to the owner and sending them to model providers while running a conversation, we disclose their text to no third party.",
        },
      ],
    },
    {
      id: "share",
      heading: "5. Sharing, transfer and disclosure",
      blocks: [
        { kind: "subheading", text: "5.1 Sharing" },
        {
          kind: "paragraph",
          strong: true,
          text: "We do not sell your personal information, and we do not share it for any third party's marketing purposes.",
        },
        {
          kind: "paragraph",
          text: "We share your information only in the following situations, and only for the lawful, legitimate, necessary, specific and explicit purposes stated in this Policy:",
        },
        {
          kind: "list",
          items: [
            "with your explicit consent;",
            "with the service providers listed in section 6, so they can supply infrastructure, payment, email or model inference services on our behalf;",
            "with other users — when you publish a character card or beautification pack, or use a share link, that content and your public profile become visible to other users;",
            "where law, litigation or dispute resolution requires it, or where a judicial or administrative authority makes a lawful demand.",
          ],
        },
        { kind: "subheading", text: "5.2 Transfer" },
        {
          kind: "paragraph",
          text: "We do not transfer your personal information to any company, organisation or individual, except with your explicit consent or in a business transfer such as a merger, acquisition or sale of assets. In that case we will require the recipient to remain bound by this Policy, failing which we will require it to seek your consent afresh.",
        },
        { kind: "subheading", text: "5.3 Public disclosure" },
        {
          kind: "paragraph",
          text: "We disclose your personal information publicly only with your explicit consent, at your own initiative, or where the law requires it.",
        },
      ],
    },
    {
      id: "subprocessors",
      heading: "6. Third-party service providers",
      blocks: [
        {
          kind: "paragraph",
          text: "We use the following third-party service providers to run the Service. They may process data only as far as is necessary to provide their service to us, and they are bound by confidentiality obligations:",
        },
        {
          kind: "list",
          items: [
            "Authentication and database hosting: Supabase — handles account credentials and stores application data.",
            "Image storage and delivery: Cloudflare R2 — stores the avatars, cover images and reference images you upload.",
            "Payment processing: Stripe — handles payments, refunds and reconciliation, including card data (which we never touch).",
            "Transactional email: Resend — sends sign-up verification, password reset and similar messages.",
            "AI model inference: Anthropic, OpenAI, Google and DeepSeek — receive the content a conversation requires and generate replies.",
          ],
        },
        {
          kind: "paragraph",
          text: "This list may change as the Service evolves. Where the change is material we will update this Policy under section 11.",
        },
      ],
    },
    {
      id: "protect",
      heading: "7. How we protect your information",
      blocks: [
        { kind: "subheading", text: "7.1 Technical measures" },
        {
          kind: "paragraph",
          text: "We apply security measures that meet industry standards and are reasonably practicable, to prevent unauthorised access, disclosure, use, alteration, damage or loss. These include site-wide transport encryption (HTTPS), one-way hashing of passwords, database row level security (RLS) that denies by default, least-privilege access control, and logging of sensitive operations.",
        },
        { kind: "subheading", text: "7.2 Organisational measures" },
        {
          kind: "paragraph",
          text: "Only people who need access to personal information to do their job may access it, and that access is logged and auditable.",
        },
        { kind: "subheading", text: "7.3 Responding to security incidents" },
        {
          kind: "paragraph",
          text: "If a security incident causes personal information to be leaked, altered or lost, we will activate our incident response promptly, take reasonable remedial steps and, as applicable law requires, tell you: the categories of information involved, the cause of the incident and the harm it may cause, the remedial steps we have taken, the steps you can take to reduce your risk, and our contact details. Where telling each person individually is impractical, we will publish a notice by reasonable and effective means such as an in-app announcement. We will also report our handling of the incident as regulators require.",
        },
        { kind: "subheading", text: "7.4 Steps you should take" },
        {
          kind: "paragraph",
          strong: true,
          text: "Use a strong password that you do not use on other sites, and keep it safe. If you think your account or password may have been exposed, contact us immediately. We will never ask you for your password through any channel.",
        },
      ],
    },
    {
      id: "store",
      heading: "8. How we store your information",
      blocks: [
        {
          kind: "subheading",
          text: "8.1 Location and international transfers",
        },
        {
          kind: "paragraph",
          text: "The Service is operated by a sole developer based in Japan. Data is stored on the overseas servers of the service providers listed in section 6, and may move between jurisdictions because of those providers' global infrastructure.",
        },
        {
          kind: "paragraph",
          text: "When choosing providers we consider whether they offer a lawful transfer mechanism, such as the EU Standard Contractual Clauses. If you are in the European Economic Area, the United Kingdom or another region with specific transfer requirements, your use of the Service indicates that you understand and accept these transfers.",
        },
        { kind: "subheading", text: "8.2 Retention periods" },
        {
          kind: "paragraph",
          text: "We keep your personal information only for as long as the purposes described in this Policy require:",
        },
        {
          kind: "list",
          items: [
            "account information and content you create: kept until you delete that content or close your account;",
            "clean-up after deletion: we remove the corresponding copies from live systems, caches and backups within 30 days;",
            "transaction and reconciliation records: kept as applicable tax and accounting law requires;",
            "security logs: kept only as long as security purposes require, normally no more than 12 months;",
            "a one-way fingerprint of a deleted account's email address: kept solely so that the new-user reward is not granted again if the same address registers a second time. It cannot be turned back into the address and is linked to no account and no content.",
          ],
        },
        {
          kind: "paragraph",
          text: "Once a retention period ends, we delete your personal information or irreversibly anonymise it.",
        },
      ],
    },
    {
      id: "rights",
      heading: "9. Managing your information",
      blocks: [
        { kind: "subheading", text: "9.1 Your rights" },
        {
          kind: "paragraph",
          text: "You have the right to access, copy, rectify, complete and delete your personal information, to withdraw your consent, to ask us to restrict or object to certain processing, and to receive the data you gave us in a structured, commonly used format.",
        },
        { kind: "subheading", text: "9.2 How to exercise them" },
        {
          kind: "paragraph",
          text: "You can do most of this in the product itself: edit your profile on the settings page, and delete your own character cards, beautification packs and sessions from the works management page.",
        },
        {
          kind: "paragraph",
          text: "You can close your account yourself from the danger zone on the settings page. Closure takes effect immediately, with no grace period and no way to undo it.",
        },
        {
          kind: "paragraph",
          text: `For anything else — including data export and withdrawal of consent — email ${LEGAL_CONTACT_EMAIL}. To protect your account we may verify your identity before acting on a request.`,
        },
        { kind: "subheading", text: "9.3 Closing your account" },
        {
          kind: "paragraph",
          text: "After you close your account we stop providing the Service to you and delete or anonymise your personal information under clause 8.2. Your account, your profile, every chat you have had, and the character cards and beautification packs you created are erased immediately and cannot be recovered. Any unused virtual currency and monthly pass entitlement expires with the account.",
        },
        {
          kind: "paragraph",
          text: "Only two things survive closure: the transaction records that tax and accounting law require us to keep under clause 8.2, which are unlinked from you, and the one-way email fingerprint that stops the new-user reward being granted twice. Separately, conversations other people had with your character cards remain as those people's own records, but because the cards are deleted those conversations cannot be continued.",
        },
        { kind: "subheading", text: "9.4 Response times and exceptions" },
        {
          kind: "paragraph",
          text: "We will respond to the requests above within 15 days. We do not normally charge for reasonable requests, but we may charge a reasonable fee for, or refuse, requests that are repetitive or manifestly excessive.",
        },
        {
          kind: "paragraph",
          text: "We may be unable to act on a request where: it relates to our compliance with a legal obligation; it relates directly to public safety or a significant public interest; it relates directly to a criminal investigation, prosecution, trial or the enforcement of a judgment; there is clear evidence of bad faith or abuse of rights on your part; acting on it would seriously harm the legitimate rights of you or of another person or organisation; or it involves trade secrets.",
        },
        { kind: "subheading", text: "9.5 Complaints" },
        {
          kind: "paragraph",
          text: "If you are not satisfied with our response, you may complain to the competent data protection authority, or seek redress under section 12 of the Terms of Service.",
        },
      ],
    },
    {
      id: "minors",
      heading: "10. Minors",
      blocks: [
        {
          kind: "paragraph",
          strong: true,
          text: "The Service is for adults aged 18 and over. We do not knowingly collect personal information from anyone under 18.",
        },
        {
          kind: "paragraph",
          text: `If we discover that we have collected a minor's personal information without verifiable authorisation, we will delete the data and close the account as soon as we can. If you are a guardian and believe a minor has given us personal information without your consent, contact ${LEGAL_CONTACT_EMAIL}.`,
        },
      ],
    },
    {
      id: "updates",
      heading: "11. Changes to this Policy",
      blocks: [
        {
          kind: "paragraph",
          text: "We may update this Policy as the Service and the technology behind it evolve. We will not reduce the rights you hold under this Policy without your explicit consent.",
        },
        {
          kind: "paragraph",
          text: "For material changes we will give more prominent notice by in-app announcement, pop-up or email. Material changes include, but are not limited to:",
        },
        {
          kind: "list",
          ordered: true,
          items: [
            "a significant change in our service model, such as a change in the purposes, categories or manner of processing personal information;",
            "a significant change in control, such as a change of data controller following a merger or restructuring;",
            "a change in the main recipients of shared, transferred or disclosed personal information;",
            "a significant change in your rights over the processing of personal information or in how you exercise them;",
            "a change in our contact details or complaints channel.",
          ],
        },
      ],
    },
    {
      id: "contact",
      heading: "12. Contacting us",
      blocks: [
        {
          kind: "paragraph",
          text: `For questions, comments or complaints about this Policy, email ${LEGAL_CONTACT_EMAIL}. We will respond within 15 days.`,
        },
        {
          kind: "paragraph",
          text: "The Service is owned and operated by a sole developer based in Japan. If you are not satisfied with our response, you may also seek redress from the competent regulator or court.",
        },
      ],
    },
  ],
};
