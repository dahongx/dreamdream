import type { Locale } from "@/i18n/config";
import {
  getSfwDocument,
  type SfwDocumentKind,
} from "@/lib/legal/sfw-documents";
import type { LegalDocument } from "@/lib/legal/types";

type Copy = readonly [string, string, string, string];
const indexes = { "ja-JP": 0, "zh-TW": 1, en: 2, "th-TH": 3 } as const;
const displayGuide: Copy = [
  "内容区分と表示の好みは探索画面やサイトの表示設定で確認できます。創作者の区分は内容の正確性や適法性を保証しません。既知の作品 URL から開く場合も、年齢条件と作品の説明を確認してください。",
  "可在探索頁或網站顯示設定查看內容分級及顯示偏好。創作者標示不代表內容必然準確或合法。透過已知作品網址開啟時，也請確認年齡條件與作品說明。",
  "Review content ratings and display preferences in Explore or site display settings. Creator ratings do not establish accuracy or legality. When opening a known work URL, check its description and the service age requirement as well.",
  "ดูระดับเนื้อหาและการตั้งค่าแสดงในหน้าสำรวจหรือการตั้งค่าเว็บ ระดับที่ผู้สร้างระบุไม่รับรองความถูกต้องหรือกฎหมาย เมื่อเปิด URL ผลงานที่ทราบ โปรดตรวจคำอธิบายและเงื่อนไขอายุด้วย",
];
const replacements: Partial<
  Record<SfwDocumentKind, Record<string, readonly Copy[]>>
> = {
  "user-agreement": {
    definitions: [
      [
        "本規約はこのウェブサイトで提供する寄情（Dearm）に適用されます。サービスは架空のキャラクターとの AI 会話、作品の作成・表示及び関連する機能を提供します。「当方」は運営会社 StarEcho Technologies Limited（商業登録番号 80678055）を指します。",
        "本協議適用於本網站提供的寄情（Dearm）服務，包括虛構角色 AI 對話、作品創作與展示及相關功能。「我們」指營運公司 StarEcho Technologies Limited，商業登記號碼 80678055。",
        "These terms apply to Dearm on this website, including AI conversations with fictional characters, creation and display of works, and related features. We means the operator, StarEcho Technologies Limited, Business Registration Number 80678055.",
        "ข้อกำหนดนี้ใช้กับ Dearm บนเว็บนี้ รวมการสนทนา AI กับตัวละครสมมติ การสร้างและแสดงผลงาน และฟังก์ชันเกี่ยวข้อง เราหมายถึงผู้ดำเนินการ StarEcho Technologies Limited หมายเลขทะเบียนธุรกิจ 80678055",
      ],
    ],
    conduct: [
      [
        "サービスは18歳以上を対象とします。作品の内容区分は創作者の申告と利用者の表示設定を用います。成人向け区分は適法性や権利処理の保証ではありません。未成年者の性的扱い、性的搾取、同意のない実在人物の性的画像、嫌がらせ、詐欺、個人情報の暴露及び違法行為の支援は禁止します。",
        "本服務僅供年滿 18 歲者使用。作品分級由創作者標示，並依使用者的顯示設定呈現。成人分級不代表內容必然合法或已取得權利。禁止未成年人性化、性剝削、未經同意的真人私密影像、騷擾、詐騙、公開他人個資及協助違法行為。",
        "The service is for adults aged 18 or older. Content ratings are declared by creators and used with viewer display preferences. An adult rating does not establish legality or permission to use material. Sexualization of minors, sexual exploitation, nonconsensual intimate imagery of real people, harassment, fraud, exposure of personal information and assistance with illegal conduct are prohibited.",
        "บริการสำหรับผู้มีอายุอย่างน้อย 18 ปี ผู้สร้างระบุระดับเนื้อหาและแสดงตามการตั้งค่าผู้ชม ระดับผู้ใหญ่ไม่รับรองความชอบด้วยกฎหมายหรือสิทธิใช้ ห้ามทำให้ผู้เยาว์เป็นเรื่องทางเพศ แสวงประโยชน์ทางเพศ ภาพส่วนตัวคนจริงไร้ความยินยอม คุกคาม ฉ้อโกง เปิดข้อมูลส่วนตัว และช่วยทำผิด",
      ],
    ],
    moderation: [
      [
        "この版ではすべての投稿を事前審査する運用や、常時のキーワード・AI 審査を行っていると約束していません。著作権侵害の申告、適法な公的要請、又は具体的な報告により禁止事項に該当すると確認された場合に、必要な範囲で対応します。モデル提供者が独自に応答を拒否することもあります。",
        "此版本未承諾逐件事前審核，亦未宣稱持續執行關鍵字或 AI 審核。遇到侵權投訴、合法的司法行政要求，或具體舉報經查核屬禁止事項時，平台會在必要範圍處理。模型供應商亦可能自行拒絕回覆。",
        "This version does not promise advance review of every submission or continuous keyword or AI screening. We respond as necessary to rights complaints, lawful official demands, or specific reports verified to concern prohibited conduct. Model providers may independently refuse a response.",
        "รุ่นนี้ไม่สัญญาตรวจก่อนทุกชิ้นหรือตรวจคำและ AI ต่อเนื่อง เราดำเนินการเท่าจำเป็นต่อคำร้องสิทธิ คำสั่งราชการชอบด้วยกฎหมาย หรือรายงานเฉพาะที่ตรวจแล้วเป็นสิ่งห้าม ผู้ให้บริการโมเดลอาจปฏิเสธคำตอบเอง",
      ],
      [
        "異議の申出では対象の作品又は会話、発生日時、問題の理由及び希望する対応を示してください。対応の範囲は確認できた事実と適用法に応じます。申告だけで自動的に削除又は復旧するものではありません。",
        "申訴請提供相關作品或對話、時間、問題原因及希望的處理方式。處理範圍依查核事實與適用法律判斷，提出舉報不代表內容會自動刪除或恢復。",
        "For review, identify the work or conversation, event time, reasons and requested action. The response depends on verified facts and applicable law. A report alone does not automatically delete or restore content.",
        "ขอทบทวนโดยระบุผลงานหรือสนทนา เวลา เหตุผล และสิ่งที่ขอ การตอบขึ้นกับข้อเท็จจริงและกฎหมาย รายงานอย่างเดียวไม่ลบหรือคืนเนื้อหาอัตโนมัติ",
      ],
    ],
  },
  "privacy-policy": {
    definitions: [
      [
        "本ポリシーはこのウェブサイトの個人情報の取扱いに適用されます。運営会社は StarEcho Technologies Limited、商業登録番号は 80678055 です。連絡先は support@dearm.ai です。",
        "本政策適用於本網站的個人資料處理。營運公司為 StarEcho Technologies Limited，商業登記號碼 80678055，聯絡信箱為 support@dearm.ai。",
        "This policy covers personal information processed for this website. The operator is StarEcho Technologies Limited, Business Registration Number 80678055. Contact support@dearm.ai.",
        "นโยบายนี้ครอบคลุมข้อมูลส่วนตัวที่ประมวลผลสำหรับเว็บนี้ ผู้ดำเนินการคือ StarEcho Technologies Limited หมายเลขทะเบียนธุรกิจ 80678055 ติดต่อ support@dearm.ai",
      ],
    ],
    subprocessors: [
      [
        "認証、業務データ及び画像は自社ホストの Supabase ソフトウェア等で処理します。決済は画面に示す PayProo 等、会話生成は設定された AI API・中継事業者、取引メールは設定されたメール提供者が担当します。必要なデータのみ、それぞれの処理目的に応じて送信します。",
        "認證、業務資料及圖片使用自架 Supabase 等軟體處理。付款由頁面顯示的 PayProo 等支付商處理，對話由設定的 AI API 或中轉服務處理，交易郵件由所配置的郵件供應商發送。按各項處理目的傳送必要資料。",
        "Self-hosted Supabase software and related systems handle authentication, application data and images. The payment provider shown at checkout, such as PayProo, processes payments; configured AI APIs and intermediaries generate replies; configured email providers send transactional mail. Necessary data is sent for each processing purpose.",
        "ซอฟต์แวร์ Supabase ที่โฮสต์เองและระบบเกี่ยวข้องดูแลการยืนยัน ข้อมูลบริการ และรูป ผู้ให้บริการที่แสดงเช่น PayProo ดูแลจ่าย AI API และตัวกลางสร้างคำตอบ ส่วนผู้ให้บริการอีเมลส่งข้อความธุรกรรม ส่งข้อมูลจำเป็นตามแต่ละวัตถุประสงค์",
      ],
    ],
    protect: [
      [
        "アクセス制御、認証、パスワードのハッシュ化及び必要なログ等により情報を保護します。通信の暗号化は利用する入口によります。現在の HTTP プレビューでは HTTPS の伝送保護は得られません。必要な担当者がサポートや安全確認のために情報を確認する場合があります。絶対的な安全を保証するものではありません。",
        "平台使用權限控制、驗證、密碼雜湊及必要日誌等保護資料。連線加密取決於使用入口，目前 HTTP 預覽地址不具備 HTTPS 傳輸保護。必要人員可能為客服或安全查核而檢視資訊，網路與儲存無法保證絕對安全。",
        "Access controls, authentication, password hashing and necessary logs help protect information. Transport encryption depends on the entry point: the current HTTP preview does not provide HTTPS transport protection. Authorized personnel may review information for support or security. Absolute security cannot be guaranteed.",
        "การควบคุมสิทธิ ยืนยัน แฮชรหัสผ่าน และบันทึกจำเป็นช่วยปกป้อง การเข้ารหัสการส่งขึ้นกับจุดเข้า ตัวอย่าง HTTP ปัจจุบันไม่มีการปกป้องการส่งแบบ HTTPS เจ้าหน้าที่ที่ได้รับอนุญาตอาจตรวจเพื่อช่วยเหลือหรือความปลอดภัย ไม่อาจรับประกันปลอดภัยสมบูรณ์",
      ],
    ],
    store: [
      [
        "主要な業務データと画像は中国本土のサーバーに保存されます。AI、決済、メール等の外部サービスは他の地域で処理する場合があります。保存期間は利用目的、法令、紛争対応、不正対策及びバックアップ周期に応じます。",
        "主要業務資料與圖片儲存於中國大陸伺服器；AI、支付、郵件等外部服務可能在其他地區處理。保存期間按使用目的、法律要求、爭議查核、防濫用及備份週期判斷。",
        "Primary application data and images are stored on servers in mainland China. External AI, payment and email services may process data elsewhere. Retention depends on purpose, legal duties, disputes, abuse prevention and backup cycles.",
        "ข้อมูลบริการหลักและรูปเก็บบนเซิร์ฟเวอร์ในจีนแผ่นดินใหญ่ AI จ่ายเงิน และอีเมลภายนอกอาจประมวลผลที่อื่น ระยะเก็บขึ้นกับวัตถุประสงค์ กฎหมาย ข้อพิพาท ป้องกันใช้ผิด และรอบสำรอง",
      ],
    ],
  },
  content: {
    purpose: [
      [
        "本サイトは18歳以上向けの架空の物語・キャラクター会話を提供します。作品は創作者の内容区分と閲覧設定に従って表示されます。内容区分は法律又は権利の確認に代わるものではありません。",
        "本網站向年滿 18 歲者提供虛構故事及角色對話。作品依創作者分級與使用者顯示設定呈現，分級不能代替合法性或權利核對。",
        "This website provides fictional stories and character conversations for adults aged 18 or older. Works follow creator ratings and viewer display settings. A rating is not a substitute for checking legality or rights.",
        "เว็บนี้มีเรื่องสมมติและสนทนาตัวละครสำหรับผู้มีอายุอย่างน้อย 18 ปี แสดงตามระดับผู้สร้างและการตั้งค่าผู้ชม ระดับไม่แทนการตรวจความชอบด้วยกฎหมายหรือสิทธิ",
      ],
      [
        "紹介、画像、タグ、設定、会話及びプロフィールに共通の法的な制限が適用されます。非公開又は架空であることは、他者の権利侵害や違法な内容を正当化しません。",
        "介紹、圖片、標籤、設定、對話及個人資料均須遵守相同法律限制。私密或虛構設定不構成侵害他人權利或發布違法內容的理由。",
        "Descriptions, images, tags, settings, conversations and profiles are subject to the same legal restrictions. Private or fictional status does not justify infringement or unlawful material.",
        "คำอธิบาย รูป แท็ก การตั้งค่า บทสนทนา และโปรไฟล์อยู่ภายใต้ข้อจำกัดกฎหมายเดียวกัน ความเป็นส่วนตัวหรือสมมติไม่ใช่เหตุชอบให้ละเมิดหรือเผยแพร่ผิดกฎหมาย",
      ],
    ],
    prohibited: [
      [
        "未成年者の性的扱い、性的搾取、同意のない実在人物の性的画像、他人の個人情報の暴露、詐欺、嫌がらせ、差別的な攻撃及び実行可能な違法行為の支援は禁止します。創作者は必要な権利を取得し、適用法に従って内容を表示してください。",
        "禁止未成年人性化、性剝削、未經同意的真人私密影像、公開他人個資、詐騙、騷擾、歧視攻擊及可執行的違法協助。創作者應取得必要權利，並依適用法律展示內容。",
        "Sexualization of minors, sexual exploitation, nonconsensual intimate imagery of real people, exposure of personal information, fraud, harassment, discriminatory attacks and actionable assistance with illegal conduct are prohibited. Creators must obtain necessary rights and comply with applicable law.",
        "ห้ามทำให้ผู้เยาว์เป็นเรื่องทางเพศ แสวงประโยชน์ทางเพศ ภาพส่วนตัวคนจริงไร้ยินยอม เปิดข้อมูลส่วนตัว ฉ้อโกง คุกคาม โจมตีเลือกปฏิบัติ และช่วยทำผิดที่ลงมือได้ ผู้สร้างต้องมีสิทธิจำเป็นและทำตามกฎหมาย",
      ],
      [
        "表示設定や内容区分を利用者に誤認させたり、他人になりすましたり、権利者の申告又は適法な公的措置を妨害したりしてはなりません。モデルや決済等の外部提供者の制限は別に適用される場合があり、当方がその解除を保証することはありません。",
        "不得誤導使用者的分級或顯示選擇、冒用他人，或阻礙權利人申訴及合法公權力措施。外部模型或支付商等限制可能另行適用，平台不保證可解除。",
        "Do not mislead users about ratings or display choices, impersonate others or obstruct rights complaints or lawful official measures. External model and payment providers may apply their own restrictions; this platform does not guarantee their removal.",
        "ห้ามทำให้เข้าใจระดับหรือการแสดงผิด แอบอ้าง หรือขัดขวางคำร้องสิทธิและมาตรการรัฐที่ชอบ ผู้ให้บริการโมเดลและจ่ายอาจมีข้อจำกัดเอง แพลตฟอร์มไม่รับประกันปลดได้",
      ],
    ],
    report: [
      [
        "権利侵害、適法な公的要請又は具体的な違法内容の報告は、URL、発生時刻及び理由を添えて support@dearm.ai へ送ってください。事実と権限を確認し、必要な範囲で対応します。",
        "侵權、合法司法行政要求或具體違法內容舉報，請附網址、時間及原因寄至 support@dearm.ai，平台核對事實及權限後按必要範圍處理。",
        "Send rights complaints, lawful official requests or specific reports of unlawful content to support@dearm.ai with URLs, times and reasons. We verify facts and authority and act as necessary.",
        "ส่งคำร้องสิทธิ คำขอรัฐที่ชอบ หรือรายงานเนื้อหาผิดกฎหมายเฉพาะไป support@dearm.ai พร้อม URL เวลา และเหตุผล เราตรวจข้อเท็จจริงกับอำนาจและทำเท่าจำเป็น",
      ],
      [
        "報告や対応に異議がある場合は、元の記録と確認に必要な資料を示して再確認を求められます。報告だけで自動削除されることや、すべての作品が事前審査済みであることを約束するものではありません。",
        "對舉報或處理有異議時，可附原記錄及所需資料申請複查。平台未承諾舉報後自動刪除，亦未宣稱所有作品已經事前審核。",
        "You may request reconsideration of a report or action using the original record and necessary evidence. A report does not promise automatic deletion, and the platform does not claim every work has been reviewed in advance.",
        "ขอพิจารณารายงานหรือการจัดการใหม่โดยแนบบันทึกเดิมและหลักฐานจำเป็นได้ รายงานไม่รับประกันลบอัตโนมัติ และแพลตฟอร์มไม่อ้างว่าทุกผลงานตรวจล่วงหน้าแล้ว",
      ],
    ],
  },
};

/** Reuse common clauses, replace deployment-specific and content-policy statements. */
export function getStandardDocument(
  kind: SfwDocumentKind,
  locale: Locale,
): LegalDocument {
  const doc = getSfwDocument(kind, locale);
  const translation = indexes[locale];
  return {
    ...doc,
    effectiveDate: "2026-11-20",
    sections: doc.sections.map((section, sectionIndex) => {
      if (kind === "guide" && section.id === "models") {
        return {
          ...section,
          blocks: [
            ...section.blocks,
            { kind: "paragraph" as const, text: displayGuide[translation] },
          ],
        };
      }
      const replacement = replacements[kind]?.[section.id];
      if (!replacement) return section;
      const keepCommon =
        kind !== "content" &&
        !(kind === "user-agreement" && section.id === "moderation");
      const tail = keepCommon ? section.blocks.slice(1) : [];
      return {
        ...section,
        blocks: [
          ...replacement.map((text, paragraphIndex) => ({
            kind: "paragraph" as const,
            text: `${sectionIndex + 1}.${paragraphIndex + 1} ${text[translation]}`,
          })),
          ...tail.map((block, index) =>
            block.kind === "paragraph"
              ? {
                  ...block,
                  text: block.text.replace(
                    /^\d+\.\d+ /,
                    `${sectionIndex + 1}.${replacement.length + index + 1} `,
                  ),
                }
              : block,
          ),
        ],
      };
    }),
  };
}

export function getSiteDocument(
  kind: SfwDocumentKind,
  locale: Locale,
): LegalDocument {
  return process.env.NEXT_PUBLIC_SFW_MODE === "1"
    ? getSfwDocument(kind, locale)
    : getStandardDocument(kind, locale);
}
