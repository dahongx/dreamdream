import type { Locale } from "@/i18n/config";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";
import { sfwDetailedClauses } from "@/lib/legal/sfw-detailed-clauses";
import { sfwServiceCopy } from "@/lib/legal/sfw-service-copy";
import type { LegalDocument } from "@/lib/legal/types";

export type SfwDocumentKind =
  | "user-agreement"
  | "privacy-policy"
  | "guide"
  | "billing"
  | "refund"
  | "content"
  | "contact";

// Japanese, Traditional Chinese, English and Thai share section IDs.
type Translation = readonly [string, string, string, string];
// Operator identity supplied by the site owner; do not infer an address or jurisdiction.
const operatorDetails: Translation = [
  "本サービスの運営者は StarEcho Technologies Limited、商業登録番号は 80678055 です。",
  "本服務由 StarEcho Technologies Limited 營運，商業登記號碼為 80678055。",
  "This service is operated by StarEcho Technologies Limited. Business Registration Number: 80678055.",
  "บริการนี้ดำเนินการโดย StarEcho Technologies Limited หมายเลขทะเบียนธุรกิจ 80678055",
];
type Section = readonly [string, Translation, Translation];
const localeIndex = { "ja-JP": 0, "zh-TW": 1, en: 2, "th-TH": 3 } as const;
const section = (
  id: string,
  heading: Translation,
  body: Translation,
): Section => [id, heading, body];
const contact: Translation = [
  `お問い合わせ先は ${LEGAL_CONTACT_EMAIL} です。登録メールアドレス、問題の発生日時、関連する注文番号や画面の情報を記載してください。パスワード、カード番号、認証コードは送らないでください。確認に追加情報が必要な場合はご案内します。`,
  `聯絡信箱為 ${LEGAL_CONTACT_EMAIL}。請提供帳戶信箱、發生時間、相關訂單編號或畫面資訊。請勿寄送密碼、完整卡號或驗證碼。需要補充資料時，我們會再聯絡您。`,
  `Contact ${LEGAL_CONTACT_EMAIL} with your account email, the time of the problem and relevant order IDs or screenshots. Never send passwords, full card numbers or verification codes. We may request additional information to investigate.`,
  `ติดต่อ ${LEGAL_CONTACT_EMAIL} โดยระบุอีเมลบัญชี เวลาที่เกิดปัญหา หมายเลขคำสั่งซื้อหรือภาพหน้าจอที่เกี่ยวข้อง ห้ามส่งรหัสผ่าน หมายเลขบัตรเต็ม หรือรหัสยืนยัน เราอาจขอข้อมูลเพิ่มเติมเพื่อตรวจสอบ`,
];

export const SFW_DOCUMENT_TITLES: Record<SfwDocumentKind, Translation> = {
  "user-agreement": [
    "利用規約",
    "使用者協議",
    "Terms of Service",
    "ข้อกำหนดการใช้บริการ",
  ],
  "privacy-policy": [
    "プライバシーポリシー",
    "隱私政策",
    "Privacy Policy",
    "นโยบายความเป็นส่วนตัว",
  ],
  guide: [
    "使い方・よくある質問",
    "使用指南與常見問題",
    "User Guide and FAQ",
    "คู่มือและคำถามที่พบบ่อย",
  ],
  billing: [
    "料金・購入について",
    "付費與扣費說明",
    "Purchases and Billing",
    "การซื้อและการคิดค่าบริการ",
  ],
  refund: ["返金について", "退款說明", "Refund Policy", "นโยบายการคืนเงิน"],
  content: ["コンテンツルール", "內容使用規則", "Content Rules", "กฎเนื้อหา"],
  contact: ["お問い合わせ", "聯絡我們", "Contact Us", "ติดต่อเรา"],
};

export const SFW_DOCUMENT_ROUTES: Record<SfwDocumentKind, string> = {
  "user-agreement": "/agreement/user",
  "privacy-policy": "/agreement/privacy",
  guide: "/agreement/guide",
  billing: "/agreement/billing",
  refund: "/agreement/refund",
  content: "/agreement/content",
  contact: "/agreement/contact",
};

const documents: Record<SfwDocumentKind, readonly Section[]> = {
  "user-agreement": [
    section(
      "definitions",
      [
        "サービスと適用範囲",
        "服務與適用範圍",
        "Service and Scope",
        "บริการและขอบเขต",
      ],
      [
        "本規約は play.dearm.ai の寄情（Dearm）に適用されます。当サービスはブラウザーで利用する架空のキャラクターとの AI 会話、日常の物語、創作支援を提供します。本規約で「当方」とはこのサービスの運営者を指します。",
        "本協議適用於 play.dearm.ai 的寄情（Dearm）服務。我們提供透過瀏覽器使用的虛構角色 AI 對話、日常故事與創作輔助。本協議中的「我們」指本服務的營運方。",
        "These terms apply to Dearm at play.dearm.ai. The browser-based service offers AI conversations with fictional characters, everyday stories and creative tools. “We” means the operator of this service.",
        "ข้อกำหนดนี้ใช้กับ Dearm ที่ play.dearm.ai ซึ่งให้บริการสนทนา AI กับตัวละครสมมติ เรื่องราวในชีวิตประจำวัน และเครื่องมือสร้างสรรค์ผ่านเว็บ คำว่าเรา หมายถึงผู้ดำเนินบริการนี้",
      ],
    ),
    section(
      "scope",
      ["規約への同意", "協議確認", "Acceptance", "การยอมรับข้อกำหนด"],
      [
        "登録前に本規約、プライバシーポリシー、料金・返金案内を確認してください。新しい規約は掲載日とともに公表します。重要な変更は合理的な方法で通知し、変更前の購入に遡って不利益な条件を適用しません。",
        "註冊前請閱讀本協議、隱私政策及付費退款說明。更新時會標明日期，重要變更會以合理方式通知。新條款不會追溯減損既有訂單已約定的權益。",
        "Read these terms, the Privacy Policy and purchase and refund information before registering. Revisions carry a date. Material changes will be communicated reasonably and will not retroactively reduce the agreed rights of existing orders.",
        "โปรดอ่านข้อกำหนด นโยบายความเป็นส่วนตัว และข้อมูลการซื้อกับคืนเงินก่อนสมัคร การแก้ไขจะแสดงวันที่และแจ้งการเปลี่ยนแปลงสำคัญตามสมควร โดยไม่ลดสิทธิที่ตกลงไว้ของคำสั่งซื้อเดิมย้อนหลัง",
      ],
    ),
    section(
      "account",
      ["アカウント", "帳戶使用", "Accounts", "บัญชีผู้ใช้"],
      [
        "利用は18歳以上に限ります。ご自身が管理するメールアドレスを使用し、認証情報を保護してください。他人へのなりすまし、不正アクセス、アカウントの不正売買は禁止します。身に覚えのない操作があればお問い合わせください。",
        "本服務僅供年滿 18 歲者使用。請使用本人可管理的電子郵件並保護登入資訊。不得冒用他人、未經授權登入或非法買賣帳戶。發現異常操作時請聯絡我們。",
        "You must be at least 18. Use an email address you control and protect your credentials. Impersonation, unauthorized access and unlawful account trading are prohibited. Contact us about suspicious activity.",
        "ผู้ใช้ต้องมีอายุอย่างน้อย 18 ปี ใช้อีเมลที่ตนควบคุมและรักษาข้อมูลเข้าสู่ระบบ ห้ามแอบอ้าง เข้าถึงบัญชีโดยไม่ได้รับอนุญาต หรือซื้อขายบัญชีโดยผิดกฎหมาย หากพบกิจกรรมผิดปกติโปรดติดต่อเรา",
      ],
    ),
    section(
      "content-ip",
      ["作品と権利", "作品與權利", "Content and Rights", "เนื้อหาและสิทธิ"],
      [
        "ご自身の投稿に対する権利はご自身に帰属します。他人の文章や画像には必要な許諾を得てください。当方は保存、表示、配信、バックアップ等、サービス提供に必要な範囲で投稿を処理します。AI 出力の権利性や独自性は保証できません。",
        "您原創內容的權利仍歸您所有。使用他人文字或圖片前應取得所需授權。我們在提供服務所需範圍內儲存、展示、傳輸及備份內容。AI 輸出的可保護性與獨創性無法保證。",
        "You retain rights in your original submissions. Obtain permission for third-party text or images. We process content as needed to store, display, deliver and back up the service. AI output may not be unique or eligible for intellectual property protection.",
        "คุณยังคงถือสิทธิในผลงานต้นฉบับของตน และต้องได้รับอนุญาตที่จำเป็นก่อนใช้ข้อความหรือภาพของผู้อื่น เราประมวลผลเนื้อหาเท่าที่จำเป็นต่อการจัดเก็บ แสดง ส่ง และสำรองข้อมูล ผลลัพธ์ AI อาจไม่เป็นเอกลักษณ์หรือได้รับความคุ้มครองทางทรัพย์สินทางปัญญา",
      ],
    ),
    section(
      "prompt-assets",
      ["公開範囲", "內容可見範圍", "Visibility", "การมองเห็นเนื้อหา"],
      [
        "公開作品の紹介や表示用素材は他の利用者に見える場合があります。非公開の設定文を、不正な方法で取り出したり配布したりしないでください。ご自身の公開設定を確認し、個人情報を紹介文に載せないでください。",
        "公開作品的介紹與展示素材可能被其他使用者看到。不得透過未經授權的方法提取或散布他人的非公開設定。請確認作品的公開設定，避免在介紹中填寫個人敏感資訊。",
        "Public descriptions and display assets may be visible to others. Do not extract or distribute another creator’s private settings without authorization. Review visibility settings and keep sensitive personal information out of public descriptions.",
        "คำอธิบายและสื่อแสดงผลของผลงานสาธารณะอาจปรากฏต่อผู้อื่น ห้ามดึงหรือเผยแพร่การตั้งค่าส่วนตัวของผู้สร้างโดยไม่ได้รับอนุญาต ตรวจสอบการมองเห็นและอย่าใส่ข้อมูลส่วนบุคคลอ่อนไหวในคำอธิบายสาธารณะ",
      ],
    ),
    section(
      "conduct",
      ["利用ルール", "使用規則", "Acceptable Use", "การใช้งานที่ยอมรับได้"],
      [
        "性的に露骨な内容、未成年者の性的描写、強要、残虐な暴力、嫌がらせ、差別、詐欺、違法行為の支援を求めたり投稿したりしないでください。他人のプライバシーや権利を尊重し、安全対策の回避やサービス妨害を行わないでください。",
        "不得要求或發布露骨色情、涉及未成年人的性內容、強迫、血腥暴力、騷擾、歧視、詐騙或協助違法行為的內容。請尊重他人隱私與權利，不得繞過安全限制或干擾服務。",
        "Do not request or publish explicit sexual content, sexual content involving minors, coercion, graphic violence, harassment, discrimination, fraud or assistance with illegal activity. Respect others’ rights and privacy. Do not bypass safeguards or disrupt the service.",
        "ห้ามขอหรือเผยแพร่เนื้อหาทางเพศโจ่งแจ้ง เนื้อหาทางเพศเกี่ยวกับผู้เยาว์ การบังคับ ความรุนแรงนองเลือด การคุกคาม การเลือกปฏิบัติ การฉ้อโกง หรือความช่วยเหลือในการกระทำผิด เคารพสิทธิและความเป็นส่วนตัว และห้ามหลบเลี่ยงมาตรการความปลอดภัยหรือรบกวนบริการ",
      ],
    ),
    section(
      "moderation",
      [
        "違反への対応",
        "違規與申訴",
        "Enforcement and Appeals",
        "การจัดการการละเมิดและอุทธรณ์",
      ],
      [
        "違反の疑いがある内容やアカウントについて、調査、公開停止、生成の中断、利用制限等を行う場合があります。モデル側が応答を拒否する場合もあります。誤りと思われる場合は対象の画面や日時を添えてお問い合わせください。個別に確認します。",
        "對疑似違規內容或帳戶，我們可能調查、限制展示、停止生成或限制使用。模型供應商也可能拒絕回覆。若您認為處理有誤，請附上相關畫面與時間提出申訴，我們會個別確認。",
        "Suspected violations may lead to investigation, restricted visibility, interrupted generation or account restrictions. Model providers may also refuse requests. If you believe a decision was wrong, contact us with the relevant screen and time for review.",
        "กรณีสงสัยว่าละเมิด เราอาจตรวจสอบ จำกัดการแสดงผล หยุดการสร้าง หรือจำกัดบัญชี ผู้ให้บริการโมเดลอาจปฏิเสธคำขอด้วย หากคิดว่ามีข้อผิดพลาด โปรดติดต่อพร้อมภาพและเวลาเพื่อให้ตรวจสอบเป็นรายกรณี",
      ],
    ),
    section(
      "ai",
      ["AI の限界", "AI 回覆的限制", "AI Limitations", "ข้อจำกัดของ AI"],
      [
        "キャラクターと会話は架空です。AI は誤りや不適切な表現を生成し、応答の一貫性や速度が変動する場合があります。出力は医療、法律、投資等の専門的助言ではありません。重要な事実は別途確認してください。",
        "角色與對話屬於虛構。AI 可能出錯或產生不合適文字，回覆品質、一致性與速度可能變動。輸出不構成醫療、法律或投資等專業建議，重要事實請另行查證。",
        "Characters and conversations are fictional. AI can be wrong or inappropriate, and quality, consistency and speed vary. Output is not professional medical, legal or investment advice. Independently verify important facts.",
        "ตัวละครและบทสนทนาเป็นเรื่องสมมติ AI อาจผิดพลาดหรือสร้างข้อความไม่เหมาะสม คุณภาพ ความสม่ำเสมอ และความเร็วอาจเปลี่ยนแปลง ผลลัพธ์ไม่ใช่คำแนะนำวิชาชีพด้านการแพทย์ กฎหมาย หรือการลงทุน โปรดตรวจสอบข้อเท็จจริงสำคัญ",
      ],
    ),
    section(
      "payments",
      ["購入と返金", "付費與退款", "Purchases and Refunds", "การซื้อและคืนเงิน"],
      [
        "価格、通貨、有効期間、特典は購入前の商品・決済画面で確認してください。月間パスは一回払いで、自動更新しません。付与は決済成功の確認後に行います。誤請求、未付与等は返金案内に従い調査します。法定の権利は制限しません。",
        "價格、幣別、期限與權益以付款前商品及結帳頁顯示為準。月卡為一次性購買，不會自動續費。付款成功確認後發放權益。重複扣款、未到帳等依退款說明查核處理，不限制依法享有的權利。",
        "Review the price, currency, duration and benefits shown before payment. Monthly passes are one-time purchases with no automatic renewal. Benefits are delivered after successful payment is confirmed. Billing errors and missing delivery are investigated under the Refund Policy. Statutory rights remain available.",
        "ตรวจสอบราคา สกุลเงิน ระยะเวลา และสิทธิก่อนจ่ายเงิน บัตรรายเดือนซื้อครั้งเดียวและไม่ต่ออายุอัตโนมัติ สิทธิจะได้รับหลังยืนยันการชำระสำเร็จ การคิดเงินผิดหรือไม่ได้รับสิทธิจะตรวจสอบตามนโยบายคืนเงิน โดยไม่จำกัดสิทธิตามกฎหมาย",
      ],
    ),
    section(
      "copyright",
      [
        "権利侵害の申告",
        "侵權投訴",
        "Rights Complaints",
        "การร้องเรียนการละเมิดสิทธิ",
      ],
      [
        "権利侵害を申告する場合は、権利者の連絡先、権利の根拠、対象 URL、問題の説明を送ってください。必要な資料を確認して対応し、反論がある場合も個別に確認します。",
        "提出侵權投訴時，請提供權利人聯絡方式、權利證明、相關網址與問題說明。我們會查核必要資料後處理，收到異議時也會個別確認。",
        "Report infringement with the rights holder’s contact details, evidence of rights, the relevant URL and a description. We will review the necessary information and consider any counterstatement individually.",
        "แจ้งการละเมิดพร้อมข้อมูลติดต่อผู้ถือสิทธิ หลักฐานสิทธิ URL และคำอธิบาย เราจะตรวจสอบข้อมูลที่จำเป็นและพิจารณาคำโต้แย้งเป็นรายกรณี",
      ],
    ),
    section(
      "liability",
      [
        "サービス障害と責任",
        "服務異常與責任",
        "Service Issues and Responsibility",
        "ปัญหาบริการและความรับผิด",
      ],
      [
        "保守、ネットワーク、第三者サービスにより中断が生じる場合があります。当方の管理下の問題は合理的な範囲で調査・是正し、有料サービスの未提供は個別に対応します。本規約は、強行法規上免除できない当方の責任を免除するものではありません。",
        "維護、網路或第三方服務可能造成中斷。我們會合理調查並修正可控制的問題，已付費而未提供服務的情況將個別處理。本協議不免除依法不得免除的責任。",
        "Maintenance, networks or third-party services can cause interruptions. We will reasonably investigate and remedy issues within our control and address paid services not delivered. These terms do not exclude responsibilities that cannot lawfully be excluded.",
        "การบำรุงรักษา เครือข่าย หรือบริการภายนอกอาจทำให้หยุดชะงัก เราจะตรวจสอบและแก้ไขปัญหาในขอบเขตควบคุมอย่างสมเหตุสมผล และพิจารณาบริการที่จ่ายแล้วแต่ไม่ได้รับ ข้อกำหนดนี้ไม่ยกเว้นความรับผิดที่กฎหมายห้ามยกเว้น",
      ],
    ),
    section(
      "law",
      ["紛争の相談", "爭議處理", "Resolving Disputes", "การระงับข้อพิพาท"],
      [
        "問題があれば、まず関連する注文や利用記録を添えてお問い合わせください。誠実に協議します。お住まいの地域の強行的な消費者保護法による権利や、利用可能な公的救済手段は妨げません。",
        "發生爭議時，請先提供相關訂單或使用記錄與我們聯絡，雙方誠信協商。本協議不排除您居住地強制性消費者保護法律賦予的權利或可使用的救濟途徑。",
        "Contact us first with relevant order or usage records so we can discuss the issue in good faith. These terms do not remove mandatory consumer protections in your jurisdiction or available public remedies.",
        "หากมีข้อพิพาท โปรดติดต่อพร้อมบันทึกคำสั่งซื้อหรือการใช้งานเพื่อหารือโดยสุจริต ข้อกำหนดนี้ไม่ตัดสิทธิผู้บริโภคที่บังคับใช้ในเขตอำนาจของคุณหรือช่องทางเยียวยาที่มีอยู่",
      ],
    ),
    section(
      "termination",
      [
        "退会と終了",
        "停止使用與註銷",
        "Leaving the Service",
        "การยุติการใช้บริการ",
      ],
      [
        "設定から退会を申請できます。退会はご自身の内容へのアクセスを失う操作です。必要な記録を事前に保存し、未解決の請求や返金は退会前にご相談ください。退会だけでは自動返金は行われません。",
        "您可在設定中申請註銷帳戶。註銷後將無法存取自己的內容，請先保存需要的記錄。未解決的付款或退款問題，建議先聯絡處理。註銷本身不會自動產生退款。",
        "You can request account deletion in Settings. Deletion removes access to your content, so save needed records first. Contact us about unresolved billing or refund issues before deletion. Deletion alone does not issue a refund.",
        "คุณขอลบบัญชีได้ในหน้าตั้งค่า เมื่อลบแล้วจะเข้าถึงเนื้อหาของตนไม่ได้ จึงควรเก็บบันทึกที่จำเป็นก่อน โปรดติดต่อเรื่องชำระเงินหรือคืนเงินที่ยังค้าง การลบบัญชีไม่ทำให้คืนเงินอัตโนมัติ",
      ],
    ),
    section(
      "misc",
      [
        "文書と更新",
        "文件與更新",
        "Documents and Updates",
        "เอกสารและการปรับปรุง",
      ],
      [
        "プライバシーポリシー、コンテンツルール、料金・返金案内も合わせて確認してください。翻訳間に差異があっても、利用者の法定の権利を減じる解釈はしません。重要な条件変更は掲載日とともに通知します。",
        "請一併閱讀隱私政策、內容規則及付費退款說明。各語言出現差異時，不以減損使用者法定權利的方式解釋。重要條件變更會標明日期並通知。",
        "Also read the Privacy Policy, Content Rules and purchase and refund information. Differences between translations will not be interpreted to reduce statutory user rights. Material changes will be dated and communicated.",
        "โปรดอ่านนโยบายความเป็นส่วนตัว กฎเนื้อหา และข้อมูลการซื้อกับคืนเงินร่วมกัน ความแตกต่างของคำแปลจะไม่ตีความเพื่อลดสิทธิตามกฎหมาย การเปลี่ยนแปลงสำคัญจะแสดงวันที่และแจ้งให้ทราบ",
      ],
    ),
    section(
      "contact",
      ["お問い合わせ", "聯絡我們", "Contact", "ติดต่อ"],
      contact,
    ),
  ],
  "privacy-policy": [
    section(
      "definitions",
      ["適用範囲", "適用範圍", "Scope", "ขอบเขต"],
      [
        "本ポリシーは play.dearm.ai でのアカウント、会話、購入等に伴う個人情報の取扱いを説明します。外部の決済画面等では当該提供者のポリシーも確認してください。",
        "本政策說明 play.dearm.ai 在帳戶、對話及購買等流程中如何處理個人資料。進入外部付款頁等服務時，也請閱讀該供應商的政策。",
        "This policy explains personal data processing for accounts, conversations and purchases at play.dearm.ai. External services such as payment pages also have their own policies.",
        "นโยบายนี้อธิบายการจัดการข้อมูลบัญชี บทสนทนา และการซื้อที่ play.dearm.ai บริการภายนอก เช่น หน้าชำระเงิน มีนโยบายของตนเองด้วย",
      ],
    ),
    section(
      "collect",
      ["収集する情報", "收集的資料", "Data Collected", "ข้อมูลที่เก็บ"],
      [
        "登録メール、暗号学的ハッシュで保護されたパスワード、任意のプロフィール、作成した作品、会話、画像、設定を保存します。注文番号、金額、通貨、決済状態、権利付与と利用履歴、セキュリティ上必要な IP・端末・アクセス記録を処理します。完全なカード番号やセキュリティコードは保存しません。",
        "我們儲存註冊信箱、以雜湊保護的密碼、您選填的個人資料、作品、對話、圖片及設定。也處理訂單編號、金額、幣別、付款狀態、權益與使用記錄，以及安全維運需要的 IP、裝置與存取記錄。不儲存完整卡號或安全碼。",
        "We store your registration email, hashed password, optional profile, creations, conversations, images and settings. We process order IDs, amounts, currencies, payment status, benefits, usage and necessary security and access logs such as IP and device information. We do not store full card numbers or security codes.",
        "เราเก็บอีเมลสมัคร รหัสผ่านแบบแฮช โปรไฟล์ที่เลือกกรอก ผลงาน บทสนทนา รูปภาพ และการตั้งค่า รวมถึงหมายเลขคำสั่งซื้อ จำนวนเงิน สกุลเงิน สถานะชำระ สิทธิ การใช้งาน และบันทึกความปลอดภัยที่จำเป็น เช่น IP และอุปกรณ์ เราไม่เก็บเลขบัตรเต็มหรือรหัสความปลอดภัย",
      ],
    ),
    section(
      "cookies",
      [
        "Cookie と端末保存",
        "Cookie 與本機儲存",
        "Cookies and Local Storage",
        "คุกกี้และที่จัดเก็บในเครื่อง",
      ],
      [
        "認証 Cookie はログイン維持に、nj_locale は言語選択に使用します。草稿や表示設定は端末に保存される場合があります。Cookie を削除すると再ログインが必要になる場合があります。共有端末ではログアウトしてください。",
        "登入 Cookie 用來維持登入，nj_locale 記錄語言選擇。草稿與介面偏好可能儲存在您的裝置。清除 Cookie 可能需要重新登入，使用共用裝置後請登出。",
        "Authentication cookies maintain login and nj_locale stores language preferences. Drafts and display preferences may be stored on your device. Clearing cookies may require signing in again. Sign out on shared devices.",
        "คุกกี้ยืนยันตัวตนใช้คงสถานะเข้าสู่ระบบ และ nj_locale เก็บภาษาที่เลือก ร่างและการแสดงผลอาจเก็บในอุปกรณ์ การล้างคุกกี้อาจต้องเข้าสู่ระบบใหม่ โปรดออกจากระบบเมื่อใช้เครื่องร่วมกัน",
      ],
    ),
    section(
      "ai-processing",
      ["AI への送信", "AI 處理", "AI Processing", "การประมวลผล AI"],
      [
        "応答の生成には、メッセージ、必要な会話履歴、キャラクターや面具の設定を、選択したモデルの API 提供者および中継サービスに送信します。中継先にはモデルの開発会社とは異なる事業者が含まれる場合があります。当方がサービス提供に使うデータを独自のモデル学習に使用することはありません。第三者の保持・処理はその契約とポリシーにも従います。機密情報を入力しないでください。",
        "為生成回覆，訊息、必要歷史對話、角色及面具設定會傳送到所選模型的 API 供應商與中轉服務。中轉服務可能與模型開發公司不同。我們不將提供服務取得的資料用於自行訓練模型。第三方的保留與處理也受其合約與政策約束，請勿輸入機密資訊。",
        "Generating replies sends messages, necessary history and character and persona settings to the selected model’s API provider and intermediary services. Intermediaries may differ from the model developer. We do not use service data to train our own models. Third-party retention and processing also follow their contracts and policies. Do not submit confidential information.",
        "การสร้างคำตอบจะส่งข้อความ ประวัติที่จำเป็น และการตั้งค่าตัวละครกับหน้ากากไปยังผู้ให้บริการ API และตัวกลาง ซึ่งอาจต่างจากผู้พัฒนาโมเดล เราไม่ใช้ข้อมูลบริการฝึกโมเดลของเราเอง การเก็บและประมวลผลของบุคคลภายนอกขึ้นกับสัญญาและนโยบายของเขาด้วย หลีกเลี่ยงข้อมูลลับ",
      ],
    ),
    section(
      "share",
      ["利用と共有", "使用與分享", "Use and Sharing", "การใช้และแบ่งปัน"],
      [
        "情報はサービスの提供、決済照合、サポート、不正防止および法令対応に必要な範囲で処理します。個人情報を販売しません。公開した作品の表示情報は他の利用者が閲覧できます。法的な要求への対応等、正当な根拠のある場合に必要な情報を提供することがあります。",
        "資料用於提供服務、付款核對、客服、防止濫用及履行法律義務。我們不出售個人資料。公開作品的展示資訊可被其他使用者看到。依法要求等有正當依據時，可能提供必要資訊。",
        "We process data for service delivery, payment reconciliation, support, abuse prevention and legal obligations. We do not sell personal data. Display information in public creations is visible to others. Necessary data may be disclosed on a valid basis such as a lawful request.",
        "เราใช้ข้อมูลเพื่อให้บริการ ตรวจสอบการจ่ายเงิน ช่วยเหลือ ป้องกันการละเมิด และปฏิบัติตามกฎหมาย ไม่ขายข้อมูลส่วนบุคคล ข้อมูลแสดงผลของงานสาธารณะผู้อื่นอาจเห็นได้ และอาจเปิดเผยข้อมูลที่จำเป็นเมื่อมีเหตุชอบด้วยกฎหมาย",
      ],
    ),
    section(
      "subprocessors",
      ["外部サービス", "第三方服務", "Service Providers", "ผู้ให้บริการภายนอก"],
      [
        "現在の提供構成では、Cloudflare が通信の保護・配信を、自社ホストの Supabase ソフトウェアとデータベースが認証・業務データ・画像保存を担います。決済は画面に表示される PayProo 等の決済事業者、会話生成は設定された AI API・中継事業者が処理します。メール送信を利用する場合は設定されたメール配信事業者が宛先等を処理します。",
        "目前使用 Cloudflare 保護及傳送網站流量，自架 Supabase 軟體與資料庫提供認證、業務資料及圖片儲存。付款由結帳頁顯示的 PayProo 等支付供應商處理，對話由設定的 AI API 與中轉服務處理。若發送交易郵件，設定的郵件服務會處理收件地址等必要資料。",
        "The current setup uses Cloudflare for traffic protection and delivery and self-hosted Supabase software and databases for authentication, application data and images. Payments use the provider shown at checkout, such as PayProo. Configured AI API and intermediary services generate replies. When transactional email is sent, the configured email service processes necessary recipient information.",
        "ปัจจุบันใช้ Cloudflare ป้องกันและส่งทราฟฟิก ใช้ซอฟต์แวร์ Supabase และฐานข้อมูลที่โฮสต์เองสำหรับยืนยันตัวตน ข้อมูลบริการ และรูปภาพ การจ่ายเงินใช้ผู้ให้บริการที่แสดงในหน้าชำระ เช่น PayProo ส่วน AI API และตัวกลางที่ตั้งค่าไว้สร้างคำตอบ หากมีอีเมลธุรกรรม บริการอีเมลจะประมวลผลข้อมูลผู้รับที่จำเป็น",
      ],
    ),
    section(
      "protect",
      ["保護措置", "資料保護", "Safeguards", "มาตรการป้องกัน"],
      [
        "HTTPS、アクセス権限、パスワードのハッシュ化等を利用します。必要な担当者がサポートや安全確認のために情報を確認する場合があります。ネット上の通信や保管に絶対的な安全を保証することはできません。",
        "我們使用 HTTPS、存取權限及密碼雜湊等措施。必要的處理人員可能為客服或安全查核而查看資料。網路傳輸與儲存無法保證絕對安全。",
        "We use HTTPS, access controls and password hashing. Authorized personnel may review information for support or security. No network transmission or storage can be guaranteed absolutely secure.",
        "เราใช้ HTTPS การควบคุมสิทธิ และการแฮชรหัสผ่าน เจ้าหน้าที่ที่จำเป็นอาจตรวจข้อมูลเพื่อช่วยเหลือหรือความปลอดภัย การส่งและจัดเก็บออนไลน์ไม่อาจรับประกันความปลอดภัยสมบูรณ์",
      ],
    ),
    section(
      "store",
      [
        "保存場所と期間",
        "儲存地點與期限",
        "Storage and Retention",
        "ที่จัดเก็บและระยะเวลา",
      ],
      [
        "現在、ウェブ接続は日本の入口を経由し、主要な業務データと画像は中国本土のサーバーに保存されます。AI・決済等の外部サービスにより他の地域で処理される場合があります。データは利用目的に必要な期間保存し、削除要求、法令上の保存義務、紛争対応やバックアップの更新周期に応じて削除・匿名化します。",
        "目前網站連線經日本入口轉送，主要業務資料與圖片儲存在中國大陸伺服器。AI、支付等外部服務也可能在其他地區處理資料。資料依用途所需期間保留，並依刪除請求、法定保存義務、爭議處理及備份更新週期刪除或去識別化。",
        "Web connections currently pass through a Japanese entry point, while primary application data and images are stored on servers in mainland China. AI, payment and other providers may process data elsewhere. Data is retained as needed for its purposes and deleted or de-identified according to deletion requests, legal duties, disputes and backup rotation.",
        "ปัจจุบันการเชื่อมต่อเว็บผ่านจุดเข้าในญี่ปุ่น ข้อมูลบริการหลักและรูปภาพเก็บบนเซิร์ฟเวอร์ในจีนแผ่นดินใหญ่ ผู้ให้บริการ AI และชำระเงินอาจประมวลผลที่อื่น ข้อมูลเก็บเท่าที่จำเป็นและลบหรือทำให้ไม่ระบุตัวตนตามคำขอ หน้าที่ตามกฎหมาย ข้อพิพาท และรอบสำรองข้อมูล",
      ],
    ),
    section(
      "rights",
      [
        "確認・削除の申請",
        "資料管理與刪除",
        "Your Choices and Deletion",
        "การจัดการและลบข้อมูล",
      ],
      [
        "設定からプロフィールの変更や退会を行えます。ご自身のデータの確認、訂正、取得、削除についてはお問い合わせください。本人確認をお願いする場合があります。退会後も法定の取引記録や不正な特典再取得を防ぐメールの一方向フィンガープリントが残る場合があります。他の利用者自身の会話や、更新前のバックアップは別途保存される場合があります。",
        "您可在設定修改個人資料或註銷。需要查詢、更正、取得或刪除自己的資料時可聯絡我們，可能需要核實身分。註銷後可能保留法定交易記錄，以及防止重複領取獎勵的單向信箱指紋。其他使用者自己的對話及尚未輪替的備份可能另行保存。",
        "Settings lets you edit your profile or delete your account. Contact us to access, correct, obtain or delete your data. Identity verification may be required. Legally required transaction records and one-way email fingerprints preventing repeated reward claims may remain. Other users’ own conversations and backups awaiting rotation may be retained separately.",
        "คุณแก้ไขโปรไฟล์หรือลบบัญชีในหน้าตั้งค่าได้ ติดต่อเพื่อดู แก้ รับสำเนา หรือลบข้อมูลของตน โดยอาจต้องยืนยันตัวตน บันทึกธุรกรรมตามกฎหมายและลายนิ้วมืออีเมลทางเดียวเพื่อป้องกันรับรางวัลซ้ำอาจคงอยู่ บทสนทนาของผู้ใช้อื่นและสำรองข้อมูลที่ยังไม่หมุนเวียนอาจเก็บแยก",
      ],
    ),
    section(
      "minors",
      ["年齢条件", "年齡限制", "Age Requirement", "เงื่อนไขอายุ"],
      [
        "サービスは18歳以上を対象とします。18歳未満の方の情報が登録されたと思われる場合はお問い合わせください。確認後に適切に対応します。",
        "本服務僅供年滿 18 歲者使用。若您認為未滿 18 歲者提交了資料，請聯絡我們，確認後將作適當處理。",
        "The service is for people aged 18 or older. Contact us if you believe a person under 18 submitted information. We will investigate and take appropriate action.",
        "บริการสำหรับผู้มีอายุ 18 ปีขึ้นไป หากเชื่อว่ามีผู้ต่ำกว่า 18 ปีส่งข้อมูล โปรดติดต่อเราเพื่อตรวจสอบและดำเนินการ",
      ],
    ),
    section(
      "updates",
      ["変更", "政策更新", "Updates", "การปรับปรุง"],
      [
        "提供構成や処理方法が変わる場合は本ポリシーを更新し、日付を表示します。重要な変更は合理的な方法で通知します。",
        "服務配置或處理方式變更時，我們會更新政策並標明日期。重要變更會以合理方式通知。",
        "We update this policy and its date when our setup or processing changes. Material changes will be communicated reasonably.",
        "เมื่อระบบหรือวิธีประมวลผลเปลี่ยน เราจะปรับนโยบายและวันที่ พร้อมแจ้งการเปลี่ยนแปลงสำคัญตามสมควร",
      ],
    ),
    section(
      "contact",
      ["お問い合わせ", "聯絡我們", "Contact", "ติดต่อ"],
      contact,
    ),
  ],
  guide: [
    section(
      "start",
      ["会話を始める", "開始第一段對話", "Start a Conversation", "เริ่มบทสนทนา"],
      [
        "探索で作品を選び、ログインして「会話を始める」を押します。導入を読んで、自分の言葉や行動を入力してください。送信すると AI が応答します。",
        "在探索頁選擇角色，登入後點「開始對話」。閱讀開場後，輸入想說的話或想做的事並送出，AI 就會回覆。",
        "Choose a character in Explore, sign in and select Start Chatting. Read the opening, type what you want to say or do and send it to receive an AI reply.",
        "เลือกตัวละครในหน้าสำรวจ เข้าสู่ระบบแล้วเริ่มแชต อ่านบทเปิด พิมพ์คำพูดหรือการกระทำที่ต้องการ แล้วส่งเพื่อรับคำตอบ AI",
      ],
    ),
    section(
      "models",
      [
        "モデルと残高",
        "選模型與看扣費",
        "Models and Balance",
        "โมเดลและยอดคงเหลือ",
      ],
      [
        "入力欄上のモデル名から切り替えられます。モデルによって速度、書き方、必要なコインが異なります。送信前の表示を確認してください。状態表示は過去の利用結果を反映し、成功を保証するものではありません。",
        "點輸入框上方的模型名稱可切換模型。不同模型的速度、文風與所需幣數可能不同，送出前請看當前標示。模型狀態根據既有請求結果更新，不代表每次都能成功。",
        "Select the model name above the input to switch models. Speed, writing style and coin cost can vary. Check the current price before sending. Status reflects past request results and does not guarantee success.",
        "แตะชื่อโมเดลเหนือช่องพิมพ์เพื่อเปลี่ยน ความเร็ว สไตล์ และจำนวนเหรียญอาจต่างกัน ตรวจราคาก่อนส่ง สถานะแสดงผลคำขอที่ผ่านมาและไม่รับประกันความสำเร็จ",
      ],
    ),
    section(
      "persona",
      ["面具を使う", "使用面具", "Use a Persona", "ใช้หน้ากาก"],
      [
        "面具は会話で使う自分側の設定です。面具画面で編集・保存し、使用するものを選べます。「面具なし」も選べます。星は新しい会話で使う既定の設定で、現在の会話での選択とは別です。保存数は利用中のプランで異なります。",
        "面具是您在對話中的身分設定。可在面具頁編輯、保存並選擇使用，也能選「不使用面具」。星號代表新對話的預設選項，與目前對話使用的面具分開。可保存數量依帳戶權益而異。",
        "A persona defines your identity in a conversation. Edit, save and select one in the persona panel, or choose no persona. The star sets the default for new conversations, separately from the current conversation. Saved persona limits depend on your account benefits.",
        "หน้ากากกำหนดตัวตนของคุณในบทสนทนา แก้ บันทึก และเลือกใช้ได้ หรือเลือกไม่ใช้ ดาวกำหนดค่าเริ่มต้นของบทสนทนาใหม่ แยกจากที่ใช้ในบทสนทนาปัจจุบัน จำนวนที่บันทึกขึ้นกับสิทธิบัญชี",
      ],
    ),
    section(
      "inspiration",
      ["返信のヒント", "回覆靈感", "Reply Suggestions", "ไอเดียคำตอบ"],
      [
        "電球を押すと返信候補が表示されます。候補は入力を助ける草稿です。内容を確認して編集し、自分で送信してください。送信・生成前に料金の表示がある場合は、その内容を確認してください。",
        "點燈泡可取得回覆建議。建議是協助您輸入的草稿，請看過、修改後自行送出。若生成或送出前顯示費用，請先確認再操作。",
        "The light bulb offers reply suggestions. These are drafts to help you write. Review, edit and send them yourself. Check any displayed charge before requesting generation or sending.",
        "ปุ่มหลอดไฟแสดงไอเดียคำตอบ เป็นร่างช่วยเขียน โปรดอ่าน แก้ แล้วส่งเอง หากแสดงค่าบริการก่อนสร้างหรือส่ง ให้ตรวจสอบก่อน",
      ],
    ),
    section(
      "history",
      [
        "履歴・やり直し",
        "記錄、重說與續寫",
        "History, Retry and Continue",
        "ประวัติ ตอบใหม่ และเขียนต่อ",
      ],
      [
        "会話は会話一覧から開けます。保存・新規会話・削除の操作は確認画面を読んで行ってください。やり直しは別の応答を生成し、続きは現在の場面を進めます。生成には画面の料金が適用される場合があります。",
        "可從對話列表開啟既有記錄。保存、開新對話或刪除時請先看確認提示。重說會重新生成回覆，續寫會延續當前情節，生成可能依頁面標示扣費。",
        "Open existing history from the conversation list. Read confirmations before saving, starting a new conversation or deleting. Retry generates another reply and Continue extends the scene. Generation may use coins as displayed.",
        "เปิดประวัติจากรายการสนทนา อ่านคำยืนยันก่อนบันทึก เริ่มใหม่ หรือลบ ตอบใหม่สร้างคำตอบอีกแบบ ส่วนเขียนต่อดำเนินฉากต่อ การสร้างอาจหักเหรียญตามที่แสดง",
      ],
    ),
    section(
      "problems",
      [
        "応答しない場合",
        "不回覆或出錯怎麼辦",
        "If a Reply Fails",
        "เมื่อไม่ได้รับคำตอบ",
      ],
      [
        "送信中は重複送信を避け、接続と残高を確認してください。モデル利用不可は提供経路の問題、内容制限はモデルが内容を拒否した可能性を示します。簡単な内容に変えるか別のモデルを選べます。返金やコイン返還が必要な場合は明細と発生日時を添えてお問い合わせください。",
        "生成中請避免連續重送，先確認網路與餘額。「模型不可用」通常與服務通道有關，「內容限制」表示模型可能拒絕處理相關內容。可調整為簡單內容或改用其他模型。若扣費需查核，請附幣數明細與發生時間聯絡我們。",
        "Avoid repeated sends while generating. Check connectivity and balance. Model unavailable usually concerns the service channel. Content restriction indicates a possible model refusal. Try simpler content or another model. For disputed coin charges, contact us with the balance entry and time.",
        "หลีกเลี่ยงส่งซ้ำขณะกำลังสร้าง ตรวจเครือข่ายและยอด ข้อความโมเดลใช้ไม่ได้มักเกี่ยวกับช่องทางบริการ ส่วนจำกัดเนื้อหาอาจเป็นการปฏิเสธจากโมเดล ลองเนื้อหาง่ายขึ้นหรือโมเดลอื่น หากสงสัยการหักเหรียญให้ส่งรายการและเวลาเพื่อตรวจสอบ",
      ],
    ),
    section(
      "account",
      [
        "ログイン・退会",
        "登入與註銷",
        "Login and Deletion",
        "เข้าสู่ระบบและลบบัญชี",
      ],
      [
        "ログインできない場合は登録メールを確認し、「パスワードを忘れた」から再設定してください。設定には退会機能があります。退会前に必要な内容を保存してください。操作や請求の質問は「お問い合わせ」へ。",
        "無法登入時請確認註冊信箱，並使用「忘記密碼」重設。設定頁提供註銷功能，操作前請先保存需要的內容。操作與付款疑問可從「聯絡我們」提出。",
        "If you cannot sign in, check your registration email and use Forgot Password. Account deletion is available in Settings. Save needed content before deleting. Use Contact Us for usage or billing questions.",
        "หากเข้าไม่ได้ให้ตรวจอีเมลสมัครและใช้ลืมรหัสผ่าน หน้าตั้งค่ามีการลบบัญชี โปรดเก็บเนื้อหาที่จำเป็นก่อนลบ ติดต่อเราหากสงสัยการใช้งานหรือชำระเงิน",
      ],
    ),
  ],
  billing: [
    section(
      "products",
      ["商品・価格", "商品與價格", "Products and Prices", "สินค้าและราคา"],
      [
        "販売中の商品、特典、有効期間、価格はストアで確認できます。決済画面で最終金額と通貨を確認してから支払ってください。決済方法や地域によって利用可能な通貨等が異なる場合があります。テスト決済の表示がある場合は実取引として扱わないでください。",
        "販售商品、權益、期限及價格請以商店顯示為準。付款前再次確認結帳頁的最終金額與幣別。可用付款方式或幣別可能依地區與支付渠道而異。若顯示測試付款，請勿視為正式交易。",
        "See the store for available products, benefits, durations and prices. Check the final amount and currency at checkout. Available methods and currencies can depend on region and payment channel. A checkout marked as a test is not a live purchase.",
        "ดูสินค้า สิทธิ ระยะเวลา และราคาในร้าน ตรวจยอดและสกุลเงินสุดท้ายก่อนจ่าย วิธีและสกุลเงินอาจขึ้นกับพื้นที่กับช่องทาง หากระบุว่าทดสอบการจ่าย อย่าถือเป็นธุรกรรมจริง",
      ],
    ),
    section(
      "coins",
      ["コインの利用", "金幣與銀幣", "Gold and Silver Coins", "เหรียญทองและเงิน"],
      [
        "コインはサービス内の対象機能に使用します。モデルと機能ごとに必要量が異なるため実行前の表示を確認してください。コインは現金・預金ではなく、利用者間の自由な換金・送金はできません。付与や消費は残高明細で確認できます。",
        "金幣、銀幣用於站內適用功能。不同模型與功能所需數量可能不同，請看操作前標示。站內幣不是現金或存款，不提供使用者間自由兌現或轉帳。發放與消耗可在餘額明細查看。",
        "Gold and silver are used for eligible features in the service. Costs vary by model and feature, so check before proceeding. Coins are not cash or deposits and cannot be freely cashed out or transferred between users. Grants and usage appear in your balance history.",
        "เหรียญทองและเงินใช้กับฟังก์ชันที่รองรับ ค่าใช้ขึ้นกับโมเดลและฟังก์ชัน โปรดดูก่อนใช้ เหรียญไม่ใช่เงินสดหรือเงินฝาก และไม่สามารถแลกเงินหรือโอนกันอย่างเสรี ดูการได้รับและใช้ในประวัติยอด",
      ],
    ),
    section(
      "pass",
      ["月間パス", "月卡期限", "Monthly Passes", "บัตรรายเดือน"],
      [
        "月間パスは30日間の一回払い商品です。自動更新・自動継続課金はありません。現在のプランと期限はアカウント画面で確認できます。再購入時の付与・期間は購入画面の案内に従います。",
        "月卡為 30 日一次性購買商品，不會自動續訂或到期扣款。可在帳戶頁查看目前權益與到期日。再次購買時的權益與期限，請以購買頁說明為準。",
        "Monthly passes are one-time 30-day purchases with no automatic renewal or recurring charge. View your benefits and expiry in your account. Repurchase benefits and duration follow the information shown when purchasing.",
        "บัตรรายเดือนซื้อครั้งเดียวสำหรับ 30 วัน ไม่มีต่ออายุหรือหักเงินซ้ำอัตโนมัติ ดูสิทธิและวันหมดอายุในบัญชี สิทธิและระยะเวลาเมื่อซื้อซ้ำเป็นไปตามหน้าซื้อ",
      ],
    ),
    section(
      "delivery",
      ["支払いと付与", "付款與到帳", "Payment and Delivery", "ชำระและรับสิทธิ"],
      [
        "決済は外部の決済事業者を通じて行います。支払い画面から戻っただけでは完了と確定せず、決済成功の確認後に特典を付与します。決済通知に時間がかかることがあります。引き落とされたのに届かない場合は再購入せず、注文番号を添えてご連絡ください。",
        "付款透過第三方支付處理，從付款頁回到本站並不代表到帳已確認。系統確認成功後發放權益，支付通知有時可能延遲。已扣款卻未到帳時，請先不要重複購買，保留訂單編號並聯絡我們。",
        "Payments are handled by an external provider. Returning from checkout does not alone confirm payment. Benefits are granted after success is verified. Notifications may be delayed. If charged without delivery, avoid buying again and contact us with the order ID.",
        "การชำระผ่านผู้ให้บริการภายนอก การกลับจากหน้าจ่ายไม่ยืนยันสำเร็จ สิทธิให้หลังตรวจสอบสำเร็จ การแจ้งผลอาจล่าช้า หากถูกหักแต่ไม่ได้รับ โปรดอย่าซื้อซ้ำ เก็บหมายเลขแล้วติดต่อเรา",
      ],
    ),
    section(
      "issues",
      [
        "請求・返金の相談",
        "扣費異常與退款",
        "Billing Issues and Refunds",
        "ปัญหาคิดเงินและคืนเงิน",
      ],
      [
        "会話失敗時のコイン返還と、購入代金の返金は確認対象が異なります。会話の日時・モデル・残高明細、または購入の注文番号・金額を用意してください。詳しくは返金案内をご覧ください。",
        "聊天失敗的站內幣返還與購買款項退款，需查核的記錄不同。請準備聊天時間、模型與幣數明細，或購買訂單編號及金額。詳細流程請見退款說明。",
        "Returning coins for a failed conversation and refunding a payment require different records. Provide conversation time, model and balance entry, or the purchase order ID and amount. See the Refund Policy for the process.",
        "การคืนเหรียญกรณีแชตล้มเหลวกับคืนเงินที่ซื้อใช้บันทึกต่างกัน เตรียมเวลา โมเดล และรายการเหรียญ หรือหมายเลขคำสั่งซื้อกับยอด ดูขั้นตอนในนโยบายคืนเงิน",
      ],
    ),
  ],
  refund: [
    section(
      "scope",
      ["対象", "適用範圍", "Scope", "ขอบเขต"],
      [
        "本案内はこのウェブサイトで購入したデジタルサービスに適用されます。法令により認められる取消し、返金、救済の権利を制限しません。無料付与分は支払代金の返金対象ではありません。",
        "本說明適用於本網站購買的數位服務，不限制依法享有的取消、退款或救濟權利。免費贈送部分不屬於支付款項的退款範圍。",
        "This policy covers digital services purchased on this website. It does not restrict statutory cancellation, refund or remedy rights. Free grants are not amounts paid and cannot be refunded as cash.",
        "นโยบายครอบคลุมบริการดิจิทัลที่ซื้อบนเว็บนี้ และไม่จำกัดสิทธิยกเลิก คืนเงิน หรือเยียวยาตามกฎหมาย ส่วนที่ให้ฟรีไม่ใช่เงินที่จ่ายและคืนเป็นเงินไม่ได้",
      ],
    ),
    section(
      "eligibility",
      [
        "確認する事例",
        "可申請查核的情況",
        "Cases We Investigate",
        "กรณีที่ตรวจสอบ",
      ],
      [
        "重複・誤請求、支払済みの特典の未付与、当方の原因による長時間の提供不能、身に覚えのない決済等はご相談ください。注文、利用状況、問題の原因を確認し、再付与、訂正、全額または一部返金等の対応を個別に判断します。",
        "重複或錯誤扣款、已付款權益未發放、因平台原因長時間無法提供服務、非本人授權交易等，可提出查核。我們會核對訂單、使用狀況與原因，個別評估補發、更正、全額或部分退款。",
        "Contact us about duplicate or incorrect charges, paid benefits not delivered, extended platform-caused failure to provide service or unauthorized transactions. We review orders, usage and cause to determine correction, delivery, full refund or partial refund individually.",
        "ติดต่อเรื่องหักซ้ำหรือผิด จ่ายแล้วไม่ได้รับสิทธิ บริการหยุดนานจากสาเหตุแพลตฟอร์ม หรือธุรกรรมไม่ได้อนุญาต เราตรวจคำสั่งซื้อ การใช้ และสาเหตุ เพื่อพิจารณาแก้ เติมสิทธิ คืนเต็มหรือบางส่วนเป็นรายกรณี",
      ],
    ),
    section(
      "used",
      [
        "利用済みの商品",
        "已使用與主觀體驗",
        "Used Services and Expectations",
        "บริการใช้แล้วและความคาดหวัง",
      ],
      [
        "利用済みの生成や特典については利用状況を確認します。AI の表現や好みの違いだけで返金が確約されるものではありません。ただし未提供、不具合、説明との重要な不一致、法定の権利に関する申告を一律に除外しません。問題に気づいたら速やかにご連絡ください。",
        "已使用的生成與權益會依實際狀況查核。僅因文風或個人喜好不同，不保證退款。但未提供服務、功能故障、與商品說明重大不符或依法可主張權利的情況，不會一概排除。發現問題後請儘早提出。",
        "We review actual usage for consumed generations or benefits. Differences in writing style or personal preference alone do not guarantee a refund. This does not categorically exclude nondelivery, defects, material mismatch with product descriptions or statutory claims. Contact us promptly after noticing an issue.",
        "สิทธิหรือการสร้างที่ใช้แล้วจะตรวจการใช้จริง ความต่างด้านสไตล์หรือความชอบไม่รับประกันคืนเงิน แต่ไม่ตัดกรณีไม่ได้รับ บกพร่อง ต่างจากคำอธิบายอย่างสำคัญ หรือสิทธิตามกฎหมาย โปรดแจ้งโดยเร็วเมื่อพบปัญหา",
      ],
    ),
    section(
      "request",
      ["申請方法", "如何申請", "How to Apply", "วิธียื่นคำขอ"],
      [
        `「お問い合わせ」から ${LEGAL_CONTACT_EMAIL} に連絡してください。登録メール、注文・領収番号、購入日時、金額と通貨、決済方法、申請理由、確認できる画面を添えてください。会話のコインについては発生日時とモデル名を記載してください。`,
        `請從「聯絡我們」寄信至 ${LEGAL_CONTACT_EMAIL}，提供帳戶信箱、訂單或收據編號、購買時間、金額與幣別、付款方式、申請原因及相關畫面。聊天扣幣問題請另附發生時間與模型名稱。`,
        `Use Contact Us to email ${LEGAL_CONTACT_EMAIL} with your account email, order or receipt ID, purchase time, amount and currency, payment method, reason and relevant screenshots. For chat coin charges, include the time and model.`,
        `ใช้อีเมล ${LEGAL_CONTACT_EMAIL} ในหน้าติดต่อเรา ส่งอีเมลบัญชี หมายเลขคำสั่งซื้อหรือใบเสร็จ เวลาซื้อ ยอดและสกุลเงิน วิธีชำระ เหตุผล และภาพที่เกี่ยวข้อง หากเป็นเหรียญแชตให้ระบุเวลาและโมเดล`,
      ],
    ),
    section(
      "processing",
      [
        "確認と返金方法",
        "處理方式與到帳",
        "Review and Payment Return",
        "การตรวจและคืนเงิน",
      ],
      [
        "まず注文と決済状況を確認し、不足資料や判断結果をご案内します。承認した返金は原則として元の決済方法へ戻します。受付後の確認と、決済事業者・銀行による着金には別々の時間がかかります。正確な見込みは個別にご案内し、固定日数の着金を保証しません。",
        "受理後先查核訂單與支付狀態，必要時請您補件並通知結果。核准退款原則上退回原付款方式。申請查核與支付商、銀行到帳需分別處理，實際進度個別通知，不承諾固定天數到帳。",
        "We verify the order and payment, request missing information if needed and communicate the result. Approved refunds normally return to the original payment method. Review time and bank or provider processing are separate. Estimates are provided individually, without a guaranteed fixed arrival date.",
        "เราตรวจคำสั่งซื้อและการจ่าย ขอข้อมูลเพิ่มหากจำเป็น และแจ้งผล เงินที่อนุมัติปกติคืนทางเดิม เวลาตรวจแยกจากเวลาธนาคารหรือผู้ให้บริการ เราแจ้งประมาณการเป็นรายกรณีโดยไม่รับประกันวันรับเงินตายตัว",
      ],
    ),
    section(
      "benefits",
      [
        "返金後の特典",
        "退款後的權益",
        "Benefits After a Refund",
        "สิทธิหลังคืนเงิน",
      ],
      [
        "返金する注文に対応するコイン・期間・特典を、確認した範囲で取り消しまたは調整します。無関係な購入や無料付与分を一律に失効させることはありません。返金のためにパスワードやカードの認証コードを求めることはありません。",
        "退款訂單對應的幣數、期限或權益會依核准範圍撤回或調整，不會一律清空無關購買或免費贈送部分。退款處理不會要求您的密碼或付款驗證碼。",
        "Coins, duration or benefits corresponding to a refunded order are withdrawn or adjusted within the approved scope. Unrelated purchases or free grants are not automatically wiped. We will not ask for your password or payment verification codes to process a refund.",
        "เหรียญ ระยะเวลา หรือสิทธิของคำสั่งซื้อที่คืนจะถูกถอนหรือปรับตามขอบเขตที่อนุมัติ ไม่ล้างการซื้ออื่นหรือของฟรีทั้งหมด และจะไม่ขอรหัสผ่านหรือรหัสยืนยันจ่ายเพื่อคืนเงิน",
      ],
    ),
  ],
  content: [
    section(
      "purpose",
      ["作品の範囲", "內容範圍", "Service Content", "ขอบเขตเนื้อหา"],
      [
        "ここでは日常、学び、手作り、音楽、架空の旅等の穏やかな作品を扱います。紹介、画像、会話、プロフィールにも同じ利用ルールが適用されます。",
        "本網站提供日常、學習、手工、音樂與虛構旅行等溫和故事。角色介紹、圖片、對話與個人資料均適用同一套使用規則。",
        "This website offers gentle stories about everyday life, learning, crafts, music and fictional journeys. The same rules apply to descriptions, images, conversations and profiles.",
        "เว็บนี้มีเรื่องราวอ่อนโยนเกี่ยวกับชีวิตประจำวัน การเรียน งานฝีมือ ดนตรี และการเดินทางสมมติ กฎเดียวกันใช้กับคำอธิบาย รูป บทสนทนา และโปรไฟล์",
      ],
    ),
    section(
      "prohibited",
      ["禁止する利用", "禁止的使用方式", "Prohibited Uses", "การใช้ที่ห้าม"],
      [
        "性的に露骨な内容、未成年者の性的描写、強要、残虐描写、差別や嫌がらせ、詐欺、違法行為への具体的な支援を投稿・要求しないでください。安全制限の回避や、他人の個人情報の公開も禁止します。",
        "不得發布或要求露骨色情、未成年人的性內容、強迫、血腥描寫、歧視騷擾、詐騙或具體協助違法行為。不得繞過安全限制或公開他人的個人資訊。",
        "Do not publish or request explicit sexual content, sexual content involving minors, coercion, gore, discrimination, harassment, fraud or actionable help with illegal activity. Do not bypass safeguards or expose other people’s personal information.",
        "ห้ามเผยแพร่หรือขอเนื้อหาทางเพศโจ่งแจ้ง เนื้อหาทางเพศเกี่ยวกับผู้เยาว์ การบังคับ เลือดสยอง การเลือกปฏิบัติ คุกคาม ฉ้อโกง หรือความช่วยเหลือทำผิดที่นำไปใช้ได้ ห้ามหลบมาตรการปลอดภัยหรือเปิดข้อมูลส่วนตัวผู้อื่น",
      ],
    ),
    section(
      "rights",
      ["他者の権利", "尊重他人權利", "Respect Others’ Rights", "เคารพสิทธิผู้อื่น"],
      [
        "文章、画像、キャラクター素材は自作または利用許諾のあるものを使ってください。実在人物のなりすましや無断転載は行わないでください。AI 生成でも第三者の権利確認は必要です。",
        "文字、圖片與角色素材須為自行創作或有權使用。不得冒充真人或未經授權轉載。即使使用 AI 生成，也應留意第三方權利。",
        "Use text, images and character assets you created or have permission to use. Do not impersonate real people or repost without authorization. AI generation does not remove the need to respect third-party rights.",
        "ใช้ข้อความ ภาพ และตัวละครที่สร้างเองหรือมีสิทธิใช้ ห้ามแอบอ้างบุคคลจริงหรือเผยแพร่ซ้ำไม่ได้รับอนุญาต การสร้างด้วย AI ไม่ยกเว้นการเคารพสิทธิผู้อื่น",
      ],
    ),
    section(
      "report",
      ["報告と再確認", "回報與申訴", "Reports and Appeals", "แจ้งปัญหาและอุทธรณ์"],
      [
        "問題のある内容は、対象 URL、発生日時、具体的な理由を添えてお問い合わせください。内容を確認し、必要な範囲で表示制限や利用制限を行います。誤った対応と思われる場合も同じ窓口で再確認を依頼できます。",
        "發現問題內容時，請附上網址、發生時間與具體原因聯絡我們。確認後可採取必要的展示或使用限制。若認為處理有誤，也可透過同一窗口申請複查。",
        "Report problematic content through Contact Us with its URL, time and a specific explanation. After review, we may restrict display or use as necessary. Use the same contact to request reconsideration of a decision.",
        "แจ้งเนื้อหาที่มีปัญหาผ่านติดต่อเรา พร้อม URL เวลา และเหตุผลเฉพาะ หลังตรวจอาจจำกัดการแสดงหรือใช้เท่าที่จำเป็น และขอให้พิจารณาใหม่ได้ทางเดียวกัน",
      ],
    ),
  ],
  contact: [
    section(
      "support",
      ["サポート窓口", "客服與回報", "Support", "ความช่วยเหลือ"],
      contact,
    ),
    section(
      "refund",
      [
        "返金の相談",
        "付款與退款問題",
        "Payment and Refund Questions",
        "ปัญหาชำระและคืนเงิน",
      ],
      [
        "件名に「注文・返金」と書き、注文番号、購入日時、金額・通貨、問題を記載してください。決済画面だけでなく、ご自身の残高明細も確認してください。銀行口座のパスワード等の機密情報は不要です。",
        "信件主旨請註明「訂單／退款」，附訂單編號、購買時間、金額幣別及問題說明。請同時查看付款結果和站內幣數明細，不需提供銀行密碼等機密資訊。",
        "Use “Order / Refund” in the subject and include the order ID, purchase time, amount, currency and issue. Check both the payment result and in-service balance history. Banking passwords and similar secrets are not needed.",
        "ระบุหัวข้อคำสั่งซื้อหรือคืนเงิน พร้อมหมายเลข เวลาซื้อ ยอด สกุลเงิน และปัญหา ตรวจทั้งผลชำระและประวัติเหรียญ ไม่ต้องส่งรหัสผ่านธนาคารหรือข้อมูลลับ",
      ],
    ),
    section(
      "privacy",
      [
        "プライバシー・権利の申告",
        "隱私與權利問題",
        "Privacy and Rights Requests",
        "คำขอเรื่องข้อมูลและสิทธิ",
      ],
      [
        "件名に「個人情報」または「権利侵害」と記載し、対象アカウントや URL とご要望をお知らせください。他人の権利に影響する操作には、本人または権利者の確認が必要な場合があります。",
        "隱私或侵權事項請在主旨註明「個人資料」或「侵權投訴」，提供相關帳戶或網址及您的請求。涉及他人權利的操作，可能需要核實本人或權利人身分。",
        "Use “Privacy” or “Rights Complaint” in the subject, with the relevant account or URL and your request. Actions affecting someone else’s rights may require verification of identity or authority.",
        "ระบุหัวข้อความเป็นส่วนตัวหรือร้องเรียนสิทธิ พร้อมบัญชีหรือ URL และคำขอ การดำเนินการที่กระทบสิทธิผู้อื่นอาจต้องยืนยันตัวตนหรืออำนาจ",
      ],
    ),
  ],
};

export function getSfwDocument(
  kind: SfwDocumentKind,
  locale: Locale,
): LegalDocument {
  const index = localeIndex[locale];
  return {
    title: SFW_DOCUMENT_TITLES[kind][index],
    effectiveDate: "2026-11-19",
    intro: [],
    sections: documents[kind].map(([id, headings, bodies], sectionIndex) => ({
      id,
      heading:
        kind === "guide" || kind === "contact"
          ? headings[index]
          : `${sectionIndex + 1}. ${headings[index]}`,
      blocks: [
        bodies[index] +
          ((kind === "refund" && id === "processing") ||
          (kind === "contact" && id === "refund")
            ? ` ${sfwServiceCopy(locale).replyTime}`
            : "") +
          (sectionIndex === 0 &&
          ["user-agreement", "privacy-policy", "contact"].includes(kind)
            ? ` ${operatorDetails[index]}`
            : ""),
        ...sfwDetailedClauses(kind, id, locale),
      ].map((text, paragraphIndex) => ({
        kind: "paragraph",
        text:
          kind === "guide" || kind === "contact"
            ? text
            : `${sectionIndex + 1}.${paragraphIndex + 1} ${text}`,
      })),
    })),
  };
}

export function sfwHelpLinks(locale: Locale) {
  const index = localeIndex[locale];
  return (Object.keys(SFW_DOCUMENT_ROUTES) as SfwDocumentKind[]).map(
    (kind) => ({
      href: SFW_DOCUMENT_ROUTES[kind],
      label: SFW_DOCUMENT_TITLES[kind][index],
    }),
  );
}
