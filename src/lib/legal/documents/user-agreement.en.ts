import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_DOMAIN } from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

/**
 * Dearm Terms of Service, English edition.
 *
 * Not the controlling version — clause 14.5 makes the Japanese edition
 * authoritative, because the operator is a Japanese sole developer and the
 * governing law is Japanese law. Amend ja-JP first, then mirror here.
 */
export const userAgreementEn: LegalDocument = {
  title: "Dearm Terms of Service",
  effectiveDate: "1 July 2026",
  intro: [
    {
      kind: "paragraph",
      text: "Welcome to Dearm (as defined below). These Terms of Service (the “Terms”) form the agreement between you and us governing your use of the Service.",
    },
    {
      kind: "notice",
      title: "Please read first",
      items: [
        "Read these Terms in full before using the Service, and in particular before you click to accept them during registration.",
        "Pay close attention to the clauses that exclude or limit liability and to the governing law and dispute resolution clauses. Those clauses appear in bold throughout this document.",
        "You may not use the Service if you are under 18 (see clause 3.1).",
      ],
    },
    { kind: "subheading", text: "What Dearm is" },
    {
      kind: "paragraph",
      text: `Dearm is an AI character chat and interactive storytelling platform open to users of all orientations, operating at ${LEGAL_SITE_DOMAIN}. We give creators tools for building character cards, regex-based beautification packs, AI-assisted generation and a debug mode, and we let other users interact with those works.`,
    },
    {
      kind: "paragraph",
      text: "Our founding principle is that content created by users belongs to those users. We make no copyright claim over your creations, and we process your content only to the minimum extent needed to provide, operate and maintain the Service. Whether to publish, whether to allow others to view or build on your work, and how to dispose of it are entirely your decisions.",
    },
    { kind: "subheading", text: "How you accept these Terms" },
    {
      kind: "paragraph",
      text: "When you accept these Terms as prompted during registration and complete the sign-up process, or when you access or use the Service, you confirm that you have read, understood and accepted these Terms in full, and you become a Dearm user (“you”).",
    },
    {
      kind: "paragraph",
      text: "If you do not agree to these Terms or to any clause within them, stop the registration process and stop using the Service.",
    },
  ],
  sections: [
    {
      id: "definitions",
      heading: "1. Interpretation and definitions",
      blocks: [
        {
          kind: "paragraph",
          text: "The following terms have the meanings set out below, whether used in the singular or the plural.",
        },
        {
          kind: "list",
          items: [
            `Dearm: the AI character chat and interactive storytelling platform operated by a sole developer based in Japan (“we”, “us”), at ${LEGAL_SITE_DOMAIN} and its subdomains.`,
            "Service: the website and related functionality provided by Dearm, including character card creation and browsing, AI conversation, regex beautification packs, AI-assisted generation, debug mode and paid features.",
            "Account: the unique account created for you to access the Service or parts of it.",
            "Content: material you post, upload, link to or otherwise provide, in any form, including text, images, regex rules, style code and other information.",
            "Character card: a character definition file created and published by a creator for other users to interact with, covering persona, setting, dialogue style and similar attributes.",
            "Beautification pack: a set of regex rules created by a creator that changes how chat messages are presented on the page, covering both static rich-text rendering and sandboxed iframe interactive components.",
            "Creator: a user who creates and publishes character cards, beautification packs or other interactive content on Dearm.",
            "Player: a user who interacts with character cards created by others on Dearm.",
            "Assets: content and other output generated through the Service, including conversation logs, story progress and AI-generated images produced while you interact with a character card.",
            "Virtual currency: the gold and silver used within the Service to settle consumable features such as AI generation, as described in section 9.",
            "Device: any device that can access the Service, such as a computer, phone or tablet.",
            "Feedback: comments, ideas or suggestions you send us about the attributes, performance or functionality of the Service.",
            "Terms: these Terms of Service, which together with the components identified below form the entire agreement between you and us.",
            "Third-party services: any service or content provided by a third party that the Service may display, embed or call, including AI model providers, payment processors and cloud service providers.",
            "You: the individual accessing or using the Service, or the company or other legal entity on whose behalf that individual acts.",
          ],
        },
      ],
    },
    {
      id: "scope",
      heading: "2. Scope and acceptance",
      blocks: [
        { kind: "subheading", text: "2.1 Effect of these Terms" },
        {
          kind: "paragraph",
          text: "These Terms set out the rights and obligations of all users in relation to the Service. They take effect when you accept them, or when you begin using the Service, whichever is earlier.",
        },
        {
          kind: "subheading",
          text: "2.2 Documents forming part of these Terms",
        },
        {
          kind: "paragraph",
          text: "Your access to and use of the Service is conditional on your accepting and complying with these Terms. They apply to every visitor, user and other person who accesses or uses the Service.",
        },
        {
          kind: "paragraph",
          text: "The Dearm Privacy Policy, together with any rules, explanations and notices we publish on the platform in future, form an inseparable part of these Terms. By using the Service you agree to comply with all of them.",
        },
        { kind: "subheading", text: "2.3 Service updates" },
        {
          kind: "paragraph",
          text: "Unless we state otherwise, these Terms also apply to any new features, products or services that Dearm adds.",
        },
      ],
    },
    {
      id: "account",
      heading: "3. Account registration and use",
      blocks: [
        { kind: "subheading", text: "3.1 Eligibility" },
        {
          kind: "paragraph",
          strong: true,
          text: "You represent that you are at least 18 years old. Dearm does not permit anyone under 18 to use the Service. You agree that every character in your work that carries sexual or adult themes is at least 18 years old.",
        },
        {
          kind: "paragraph",
          text: "You confirm that before registering you have the legal capacity required in your jurisdiction for the acts you perform. If you lack that capacity, you and your legal guardian bear all resulting consequences. Where a person lacking or having limited capacity registers improperly, the service agreement between that person and Dearm is void from the outset, and on discovering this we may suspend the Service or delete the account.",
        },
        { kind: "subheading", text: "3.2 Registration" },
        {
          kind: "paragraph",
          text: "When you create an Account you must give us accurate, complete and current registration information. Failing to do so breaches these Terms and may lead to suspension or termination of your Account.",
        },
        {
          kind: "list",
          items: [
            "Email: register with an email address you genuinely control and expect to keep. We do not recommend disposable or temporary addresses — once such an address stops working you cannot complete a password reset, and we cannot help you recover the Account.",
            "Username: you may not use another person's name, another party's trademark, a name protected by third-party rights you are not authorised to use, or an offensive or abusive name.",
          ],
        },
        { kind: "subheading", text: "3.3 Account security and personal use" },
        {
          kind: "paragraph",
          text: "You are responsible for keeping your password secure and agree not to disclose it to any third party. Tell us immediately if you discover a security weakness or unauthorised use of your Account. Your Account is for your personal use, and only one person may use each registered Account.",
        },
        { kind: "subheading", text: "3.4 Account transfer" },
        {
          kind: "paragraph",
          text: "You may transfer an Account only where the law requires it, where a court so orders, or where Dearm consents and the transfer complies with platform rules. On transfer, the rights and obligations attached to the Account pass with it.",
        },
        { kind: "subheading", text: "3.5 Keeping your information current" },
        {
          kind: "paragraph",
          text: "You must keep your information up to date. You bear any loss arising from inaccurate or lapsed information. We may ask you to re-verify your identity and may suspend the affected features until you do.",
        },
      ],
    },
    {
      id: "content-ip",
      heading: "4. Content, assets and intellectual property",
      blocks: [
        {
          kind: "paragraph",
          text: "As a platform, Dearm expressly disclaims any copyright claim over content created by users. This section sets the boundaries of each party's rights and obligations.",
        },
        {
          kind: "subheading",
          text: "4.1 Your rights and responsibility for what you post",
        },
        {
          kind: "paragraph",
          text: "You are fully responsible for the content you post. You represent and warrant that you own that content or have obtained a valid licence for it, and that it does not infringe any third-party rights.",
        },
        {
          kind: "subheading",
          text: "4.2 The limited operating licence you grant us",
        },
        {
          kind: "paragraph",
          text: "By posting content to the Service you grant us only an extremely narrow, purely technical licence, for the purpose of:",
        },
        {
          kind: "list",
          items: [
            "storing your content on servers;",
            "displaying your content to you on your own devices;",
            "displaying that content to the recipients you designate, where you have chosen to make it public;",
            "making the temporary copies unavoidably required by technical processing such as transmission, caching and format conversion.",
          ],
        },
        { kind: "paragraph", text: "We undertake that we will not:" },
        {
          kind: "list",
          items: [
            "use your content for promotion, publicity, marketing or advertising without your permission;",
            "use your content on our official accounts, social media or promotional material without your permission;",
            "bundle, compile, sell or license your content to any third party;",
            "let any other user see your content while you have not made it public;",
            "retain or use your content after you delete it, other than as these Terms expressly permit.",
          ],
        },
        { kind: "subheading", text: "4.3 Asset licence and your full rights" },
        {
          kind: "paragraph",
          text: "Assets generated through AI features belong entirely to you. Our licence over generated assets is identical in scope to the content licence above and is limited to what is necessary to provide, operate and maintain the Service for you.",
        },
        {
          kind: "list",
          items: [
            "To the extent permitted by law, you hold all rights in AI-generated assets, including the rights to use, adapt, be attributed, transfer and otherwise lawfully dispose of them.",
            "Your rights are identical whether you are a free or a paying user.",
            "Deleting your Account, deleting your works or ceasing to use the Service does not affect the rights you already hold in assets already generated.",
            "Subject to the operating licence above, you fully own every asset you create using the Service and may use it for any lawful purpose. We impose no additional restriction.",
          ],
        },
        {
          kind: "subheading",
          text: "4.4 Model training: a line we will not cross",
        },
        {
          kind: "notice",
          title: "Our model training commitment",
          items: [
            "We give this undertaking in the strongest terms: we will never, under any circumstances, use your inputs, your outputs, your conversations, your characters or your stories to train, fine-tune or evaluate any AI model, or for any other machine learning purpose.",
            "Not our own models, not a partner's models, not a third party's models. There is no exception to this.",
            "We select only model providers whose API terms expressly exclude the use of API data for model training. The provider list appears in the Privacy Policy.",
          ],
        },
        { kind: "subheading", text: "4.5 Backups" },
        {
          kind: "paragraph",
          strong: true,
          text: "Dearm backs up data regularly but does not guarantee that data will never be lost. Please keep your own backups of anything important.",
        },
        { kind: "subheading", text: "4.6 Deleting and purging content" },
        {
          kind: "paragraph",
          text: "You may delete content or close your Account at any time. Afterwards we will delete the corresponding copies from live systems, caches and backups within 30 days and stop the associated licence and display, except where:",
        },
        {
          kind: "list",
          items: [
            "law requires us to retain it;",
            "a third party lawfully obtained a copy or derivative work before deletion;",
            "the data has been irreversibly anonymised and can no longer be linked to you.",
          ],
        },
      ],
    },
    {
      id: "prompt-assets",
      heading: "5. Protection of creators' prompt assets",
      blocks: [
        {
          kind: "paragraph",
          text: "A creator's prompt engineering is their core asset. This section is an additional undertaking we give, not a restriction on your rights.",
        },
        { kind: "subheading", text: "5.1 Our confidentiality undertaking" },
        {
          kind: "paragraph",
          text: "The persona, adversity, default cognition, opening, plot setting, output setting and sample dialogue fields of a character card are prompt source material. We will not show the text of those fields to any third party, including other users, except:",
        },
        {
          kind: "list",
          items: [
            "to the owner of the character card (you can see your own full text on the edit screen);",
            "to model providers, to the extent necessary to run an AI conversation for you;",
            "where law requires it or a judicial or administrative authority lawfully demands it.",
          ],
        },
        { kind: "subheading", text: "5.2 What visitors can see" },
        {
          kind: "paragraph",
          text: "Character card detail pages, public APIs and share links expose only surface information: avatar, cover image, name, gender, age, tags, NSFW flag, bio, creator's note, visibility and conversation count, plus a sample conversation that does not reveal prompt text.",
        },
        {
          kind: "subheading",
          text: "5.3 Your obligations regarding others' prompt assets",
        },
        {
          kind: "paragraph",
          text: "You must not attempt to extract, reconstruct or distribute the prompt text of another person's character card, by technical means, social engineering or otherwise. Nor may you publish prompt content belonging to others that you learn through debug mode or any other channel.",
        },
      ],
    },
    {
      id: "conduct",
      heading: "6. User conduct",
      blocks: [
        { kind: "subheading", text: "6.1 Community standards" },
        {
          kind: "paragraph",
          text: "Treat people well and respect one another. Do not republish someone else's creation without permission.",
        },
        { kind: "subheading", text: "6.2 Prohibited uses" },
        { kind: "paragraph", text: "You must not:" },
        {
          kind: "list",
          items: [
            "infringe anyone's lawful rights;",
            "use the Service for competitive research, or use its output to train a model that competes with us;",
            "reverse engineer or decompile the Service, or attempt to obtain its source code;",
            "use automated tools to generate content in bulk, or call the Service at a rate beyond normal use;",
            "scrape or crawl platform data, or bulk-export other users' content through non-public interfaces;",
            "use the Service in fields requiring professional qualification, such as medicine, law or finance, or rely on its output for decisions with real-world consequences;",
            "do anything else that harms the legitimate interests of Dearm or of other users.",
          ],
        },
        { kind: "subheading", text: "6.3 Prohibited content" },
        {
          kind: "paragraph",
          text: "Dearm does not impose its own moral standard on creative subject matter, but the following are legal red lines and are prohibited in all circumstances:",
        },
        {
          kind: "list",
          items: [
            "any content that sexualises minors or implies the sexualisation of minors;",
            "sexualised material using a real person's identity, likeness or identifiable features without authorisation, and content that infringes a real individual's privacy or reputation;",
            "any other content that is unlawful under applicable law.",
          ],
        },
        { kind: "subheading", text: "6.4 Self-declaring NSFW content" },
        {
          kind: "paragraph",
          text: "If your fictional work contains adult themes, tick the NSFW flag when you publish it. That flag is only a filter for other users: it does not restrict what you may create, and it will not cause your work to be demoted or hidden. Mis-flagging can put your work in front of users who did not want to see it, so please declare it honestly.",
        },
      ],
    },
    {
      id: "moderation",
      heading: "7. Our position on content",
      blocks: [
        { kind: "subheading", text: "7.1 We do not pre-moderate" },
        {
          kind: "paragraph",
          text: "Dearm does not proactively scan user content, filter it by keyword or review it with AI. We will not take your work down because of its subject matter, its explicitness or its style. This is a deliberate product position and the core difference between us and comparable platforms.",
        },
        { kind: "subheading", text: "7.2 When we do act on content" },
        {
          kind: "paragraph",
          strong: true,
          text: "We restrict access to, unpublish or delete specific content only where: a rights holder submits a copyright complaint under section 10; a judicial or administrative authority makes a lawful demand; or we receive a specific report and confirm that the content falls within the legal red lines in clause 6.3. Otherwise we do not intervene.",
        },
        { kind: "subheading", text: "7.3 Reporting" },
        {
          kind: "paragraph",
          text: `You can complain or report through the in-product channel or by emailing ${LEGAL_CONTACT_EMAIL}. Please tell us where the content is and why you believe it breaches these Terms.`,
        },
      ],
    },
    {
      id: "ai",
      heading: "8. AI provisions",
      blocks: [
        { kind: "subheading", text: "8.1 Nature of AI output" },
        {
          kind: "paragraph",
          strong: true,
          text: "The Service integrates third-party artificial intelligence models, and all AI output is generated by those third-party models. Because AI is probabilistic and unpredictable, Dearm does not warrant that output is accurate, lawful, appropriate or fit for any purpose. AI output is not professional advice of any kind.",
        },
        { kind: "subheading", text: "8.2 Everything here is fiction" },
        {
          kind: "paragraph",
          text: "The characters and conversations on the Service are fictional. Please keep the distinction between fiction and reality clear, and do not treat AI output as a statement by a real person or as a statement of fact.",
        },
        { kind: "subheading", text: "8.3 AI-generated content markers" },
        {
          kind: "paragraph",
          text: "You must not remove, alter or conceal any marker identifying output from the Service as AI-generated. When you publish content generated here outside the platform, we recommend labelling it as AI-generated as your local law requires.",
        },
        { kind: "subheading", text: "8.4 AI-assisted generation tools" },
        {
          kind: "paragraph",
          text: "The prompt templates behind our AI-assisted generation features (the replacement HTML, global CSS, output guidance and target text generators) are our trade secrets and are not published. You may use the output of those tools freely, but you must not attempt to extract their prompt templates.",
        },
        { kind: "subheading", text: "8.5 Sandboxes and user-supplied code" },
        {
          kind: "paragraph",
          strong: true,
          text: "Beautification packs may contain HTML, CSS and JavaScript written by creators, executed in a restricted sandbox. We isolate that code technically, but we are not responsible for the correctness, security or effectiveness of a creator's code. Assess a third-party pack yourself before installing it.",
        },
      ],
    },
    {
      id: "payments",
      heading: "9. Payments, monthly passes and virtual currency",
      blocks: [
        { kind: "subheading", text: "9.1 Monthly passes" },
        {
          kind: "paragraph",
          text: "The Service offers monthly passes at several tiers. Passes are priced in Hong Kong dollars (HKD), purchased as a one-off payment through the third-party payment processor Stripe, and run for 30 days from activation.",
        },
        {
          kind: "paragraph",
          strong: true,
          text: "A monthly pass is a one-off purchase, not an auto-renewing subscription. Nothing is charged and nothing renews when it expires. Buy again if you want to continue.",
        },
        { kind: "subheading", text: "9.2 Payment and fulfilment" },
        {
          kind: "paragraph",
          text: "Stripe handles payment processing. We neither see nor store your full card number or payment credentials. Entitlements are granted when we receive confirmation of successful payment from the processor. Asynchronous methods such as Alipay and WeChat Pay may take several minutes to settle, which is normal.",
        },
        { kind: "subheading", text: "9.3 Virtual currency" },
        {
          kind: "paragraph",
          text: "The Service uses two virtual currencies, gold and silver, to settle consumable features such as AI generation. Virtual currency can be used only within the Service. It cannot be withdrawn, exchanged for fiat currency or transferred between users, and it is not a deposit, prepaid instrument or financial asset of any kind.",
        },
        {
          kind: "paragraph",
          strong: true,
          text: "When an Account is closed, or terminated under section 13, any unused virtual currency in it expires with the Account. We do not refund it or convert it.",
        },
        { kind: "subheading", text: "9.4 Refunds" },
        {
          kind: "paragraph",
          text: "Digital goods are generally non-refundable once delivered. If an entitlement you paid for was not delivered for reasons attributable to us, or if applicable law gives you a statutory right of cancellation, contact us within 14 days of becoming aware. Virtual currency already spent is outside the scope of any refund.",
        },
        { kind: "subheading", text: "9.5 Price changes" },
        {
          kind: "paragraph",
          text: "We may change monthly pass prices or the benefits attached to them. Changes do not affect entitlements you have already bought and that are still within their term.",
        },
      ],
    },
    {
      id: "copyright",
      heading: "10. Copyright complaints",
      blocks: [
        {
          kind: "paragraph",
          text: `We respect intellectual property. If you believe content on the platform infringes your copyright, send a notice to ${LEGAL_CONTACT_EMAIL}.`,
        },
        { kind: "paragraph", text: "Please include:" },
        {
          kind: "list",
          ordered: true,
          items: [
            "the signature of the rights holder or of the person authorised to act for them (an electronic signature is acceptable);",
            "a description of the copyrighted work;",
            "the specific location on the Service of the material you say is infringing;",
            "your contact details;",
            "a statement that you believe in good faith that the use is not authorised by the rights holder, its agent or the law;",
            "a statement that the information you provide is accurate and that you are authorised to act for the rights holder.",
          ],
        },
        {
          kind: "paragraph",
          text: "On receiving a notice that meets these requirements we will take the steps we consider appropriate and, where practical, notify the user complained about. That user may submit a counter-notice explaining their position.",
        },
      ],
    },
    {
      id: "liability",
      heading: "11. Limitation of liability and disclaimers",
      blocks: [
        { kind: "subheading", text: "11.1 Provided as is" },
        {
          kind: "paragraph",
          strong: true,
          text: "The Service is provided “as is” and “as available”. To the maximum extent permitted by law, Dearm gives no warranty of any kind, express or implied, including as to availability, freedom from error, accuracy, timeliness, freedom from viruses or fitness for a particular purpose.",
        },
        { kind: "subheading", text: "11.2 Cap on liability" },
        {
          kind: "paragraph",
          strong: true,
          text: "To the extent permitted by applicable law, our total liability under these Terms is capped at the amount you actually paid for the Service in the 12 months before the event giving rise to the claim. If you have paid nothing, the cap is JPY 10,000.",
        },
        {
          kind: "paragraph",
          strong: true,
          text: "We are not liable for loss of profit, loss of data, business interruption, loss of goodwill, loss of privacy, or any indirect, incidental or consequential loss.",
        },
        {
          kind: "paragraph",
          text: "These limits do not apply to damage caused by our wilful misconduct or gross negligence, and they do not exclude liability that applicable law does not allow us to exclude. If you are a consumer under the Japanese Consumer Contract Act and the damage arises from our negligence (short of wilful misconduct or gross negligence), the limits apply only to the extent that Act permits.",
        },
        { kind: "subheading", text: "11.3 Indemnity" },
        {
          kind: "paragraph",
          text: "You agree to indemnify Dearm against third-party claims that arise from, and are reasonably attributable to, your breach of these Terms, your breach of law or infringement of third-party rights, or the unlawful or infringing nature of content you posted or uploaded. This indemnity does not extend to loss caused by our own fault or by our ordinary operation of the Service.",
        },
      ],
    },
    {
      id: "law",
      heading: "12. Governing law and disputes",
      blocks: [
        { kind: "subheading", text: "12.1 Governing law" },
        {
          kind: "paragraph",
          strong: true,
          text: "These Terms are governed by and construed in accordance with the laws of Japan.",
        },
        { kind: "subheading", text: "12.2 Dispute resolution" },
        {
          kind: "paragraph",
          strong: true,
          text: "For disputes arising out of or relating to these Terms or the Service, the parties will first negotiate in good faith for 30 days. If negotiation fails, the parties agree that the Tokyo District Court has exclusive jurisdiction as the court of first instance.",
        },
        { kind: "subheading", text: "12.3 Your statutory consumer rights" },
        {
          kind: "paragraph",
          text: "Where mandatory consumer protection law in your jurisdiction gives you rights you cannot waive — such as rights held by EU users under national law, or the right to sue in the courts of your domicile — this section does not affect those rights.",
        },
        { kind: "subheading", text: "12.4 Export controls and sanctions" },
        {
          kind: "paragraph",
          text: "You represent that you are not located in a country or region subject to applicable export controls or economic sanctions, and that you are not named on any applicable sanctions list.",
        },
      ],
    },
    {
      id: "termination",
      heading: "13. Termination",
      blocks: [
        {
          kind: "paragraph",
          text: "If you breach these Terms we may suspend or terminate your Account. Except where clause 6.3 legal red lines or serious security risks are involved, we will explain our reasons before acting or as soon as practicable afterwards, and give you an opportunity to respond.",
        },
        {
          kind: "paragraph",
          text: "You may stop using the Service at any time and delete your content or close your Account under clause 4.6.",
        },
        {
          kind: "paragraph",
          text: "On termination your right to access and use the Service ends immediately, but termination does not affect rights you already hold in your own assets under clause 4.3. Sections 4, 5, 11, 12 and this section survive termination.",
        },
      ],
    },
    {
      id: "misc",
      heading: "14. General",
      blocks: [
        { kind: "subheading", text: "14.1 Feedback" },
        {
          kind: "paragraph",
          text: "We may use any feedback you give us freely, without payment and without any duty of confidence. This does not affect your rights in your own content and assets.",
        },
        { kind: "subheading", text: "14.2 Third-party sites" },
        {
          kind: "paragraph",
          text: "The Service may contain links to third-party sites. Dearm is not responsible for the content, policies or conduct of those sites.",
        },
        { kind: "subheading", text: "14.3 Severability" },
        {
          kind: "paragraph",
          text: "If any clause of these Terms is held invalid or unenforceable, the remaining clauses stay in force.",
        },
        { kind: "subheading", text: "14.4 No waiver" },
        {
          kind: "paragraph",
          text: "A failure or delay by us in exercising a right under these Terms is not a waiver of that right.",
        },
        { kind: "subheading", text: "14.5 Language versions" },
        {
          kind: "paragraph",
          text: "These Terms are published in Traditional Chinese, Japanese, Thai and English. If the versions differ, the Japanese version prevails.",
        },
        { kind: "subheading", text: "14.6 Changes to these Terms" },
        {
          kind: "paragraph",
          text: "We may amend these Terms. For material changes we will make reasonable efforts to give you 30 days' notice by in-app announcement, pop-up or email. Continuing to use the Service after a change takes effect means you accept the amended Terms. If you do not accept them, stop using the Service and close your Account under clause 4.6.",
        },
      ],
    },
    {
      id: "contact",
      heading: "15. Contact us",
      blocks: [
        {
          kind: "paragraph",
          text: `For questions, complaints or reports about these Terms, contact ${LEGAL_CONTACT_EMAIL}. We will respond within 15 days.`,
        },
        {
          kind: "paragraph",
          text: "The Service is owned and operated by a sole developer based in Japan.",
        },
      ],
    },
  ],
};
