import type { Locale } from "@/i18n/config";

const copy = {
  "zh-TW": {
    consent: "我已年滿 18 歲，已閱讀並同意",
    consentRequired: "請先確認已年滿 18 歲，並同意使用者協議與隱私政策。",
    deletion:
      "註銷後無法再使用餘額與月卡權益，亦不會自動退款。如有未解決的付款或退款問題，請先聯絡客服；依法享有的退款權利不受影響。",
    testPayment: "目前為測試付款環境，尚未開放正式收款。",
    replyTime:
      "我們爭取在收到申請後 10 個工作日內回覆。這是申請回覆時間，不是退款到帳時間；若需補件或延長查核，會另行告知。",
  },
  "ja-JP": {
    consent: "18歳以上であり、次の文書を読み、同意します：",
    consentRequired:
      "18歳以上であることと、利用規約・プライバシーポリシーへの同意を確認してください。",
    deletion:
      "退会後は残高とパス特典を使用できず、自動返金もされません。未解決の決済・返金は先にサポートへご相談ください。法定の返金権利は制限されません。",
    testPayment:
      "現在はテスト決済環境です。正式な代金の受け付けは開始していません。",
    replyTime:
      "申請を受け付けてから10営業日以内の返信を目指します。これは返金の着金期限ではありません。追加資料や確認の延長が必要な場合はご案内します。",
  },
  en: {
    consent: "I am at least 18 and have read and agree to",
    consentRequired:
      "Confirm that you are at least 18 and agree to the Terms of Service and Privacy Policy.",
    deletion:
      "Deletion ends access to your balance and pass benefits and does not issue an automatic refund. Contact support first about unresolved payment or refund issues. Statutory refund rights are unaffected.",
    testPayment:
      "Payments are currently in a test environment. Live payments are not yet available.",
    replyTime:
      "We aim to respond within 10 business days of receiving your request. This is a response target, not a refund arrival deadline. We will let you know if additional information or review time is needed.",
  },
  "th-TH": {
    consent: "ฉันมีอายุอย่างน้อย 18 ปี และได้อ่านและยอมรับ",
    consentRequired:
      "โปรดยืนยันว่าอายุอย่างน้อย 18 ปี และยอมรับข้อกำหนดการใช้บริการกับนโยบายความเป็นส่วนตัว",
    deletion:
      "เมื่อลบบัญชีจะใช้ยอดคงเหลือและสิทธิบัตรไม่ได้ และไม่มีการคืนเงินอัตโนมัติ โปรดติดต่อก่อนหากมีปัญหาชำระหรือคืนเงินที่ยังไม่จบ สิทธิคืนเงินตามกฎหมายไม่ถูกจำกัด",
    testPayment: "ขณะนี้เป็นระบบชำระเงินทดสอบ ยังไม่เปิดรับเงินจริง",
    replyTime:
      "เราตั้งเป้าตอบภายใน 10 วันทำการหลังได้รับคำขอ เป็นเป้าหมายการตอบ ไม่ใช่กำหนดเงินคืนเข้าบัญชี หากต้องการข้อมูลหรือเวลาตรวจเพิ่มจะแจ้งให้ทราบ",
  },
} satisfies Record<
  Locale,
  {
    consent: string;
    consentRequired: string;
    deletion: string;
    testPayment: string;
    replyTime: string;
  }
>;

export function sfwServiceCopy(locale: Locale) {
  return copy[locale];
}

export function hasSfwSignupConsent(form: FormData): boolean {
  return form.get("sfwConsent") === "accepted";
}
