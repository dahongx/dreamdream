import type { Locale } from "@/i18n/config";
import type { SfwDocumentKind } from "@/lib/legal/sfw-documents";

// Independently drafted clauses. Tuple order matches the existing four-language
// documents; published chapter anchors are preserved by the caller.
type Copy = readonly [string, string, string, string];
const index = { "ja-JP": 0, "zh-TW": 1, en: 2, "th-TH": 3 } as const;
const clauses: Partial<
  Record<SfwDocumentKind, Record<string, readonly Copy[]>>
> = {
  "user-agreement": {
    definitions: [
      [
        "本規約における「サービス」は当サイトで提供する会話、創作、作品表示、アカウント及び購入に関する機能を指します。「投稿内容」は利用者が入力又はアップロードする文章、画像、設定等を、「生成内容」は利用者の要求に応じて AI が返す文章等を指します。両者を区別する場合を除き、本規約の内容ルールは双方に適用されます。",
        "本協議中的「服務」指本站提供的對話、創作、作品展示、帳戶及購買相關功能。「提交內容」指您輸入或上傳的文字、圖片、設定等資料；「生成內容」指 AI 根據請求產生的文字等結果。除另有區分外，內容使用規則同時適用於兩者。",
        "Service means the conversation, creation, display, account and purchase features offered on this website. Submitted Content means material you enter or upload, including text, images and settings. Generated Content means results returned by AI in response to a request. Unless a provision distinguishes them, the content rules apply to both categories.",
        "บริการหมายถึงฟังก์ชันสนทนา สร้างสรรค์ แสดงผลงาน บัญชี และการซื้อบนเว็บนี้ เนื้อหาที่ส่งหมายถึงข้อความ รูป และการตั้งค่าที่คุณป้อนหรืออัปโหลด เนื้อหาที่สร้างหมายถึงผลลัพธ์จาก AI ตามคำขอ กฎเนื้อหาใช้กับทั้งสองประเภท เว้นแต่ระบุแยกไว้อย่างชัดเจน",
      ],
      [
        "「コイン」はサイト内で対応機能を利用するための単位、「月間パス」は購入画面に記載された期間中の特典です。外部の決済事業者、モデル提供者等は、それぞれの役割でサービスの一部を処理します。当方との契約内容と外部事業者独自の条件を混同しないでください。",
        "「站內幣」是使用指定功能的計量單位；「月卡」是在購買頁所載期間內提供的權益。支付商、模型供應商等外部服務各自處理部分流程。您與本平台的約定，以及外部供應商就其服務訂立的條件，應分別理解。",
        "Coins are internal units for eligible features. A monthly pass provides the benefits and duration specified at purchase. Payment providers, model providers and other suppliers process particular parts of the service. The terms of a purchase from us and the separate conditions of an external provider serve different roles.",
        "เหรียญเป็นหน่วยภายในสำหรับฟังก์ชันที่รองรับ บัตรรายเดือนให้สิทธิและระยะเวลาตามหน้าซื้อ ผู้ให้บริการจ่ายเงิน โมเดล และผู้จัดหารายอื่นดูแลบางส่วนของบริการ เงื่อนไขการซื้อจากเรากับเงื่อนไขบริการภายนอกมีบทบาทต่างกัน",
      ],
    ],
    scope: [
      [
        "利用開始前に、ご自身が同意する権限を持つことを確認してください。他の組織を代表して利用する場合は、その組織を拘束する権限が必要です。権限がない場合は個人として利用してください。利用条件を満たさない方は登録・購入を行わないでください。",
        "開始使用前，請確認您有權作出同意。如代表組織使用，須具有代表該組織訂立約定的權限；沒有此權限時，請勿以該組織名義作出承諾。不符合使用條件者，不應註冊或購買。",
        "Before using the service, confirm that you have authority to accept these terms. If acting for an organization, you must be authorized to make commitments for it. Without that authority, do not claim to bind the organization. A person who does not meet the eligibility conditions should not register or purchase.",
        "ก่อนใช้ โปรดตรวจว่าคุณมีอำนาจยอมรับเงื่อนไข หากใช้แทนองค์กรต้องได้รับอำนาจผูกพันองค์กร หากไม่มี ห้ามอ้างว่าทำข้อผูกพันแทนองค์กร ผู้ไม่ตรงเงื่อนไขการใช้ไม่ควรสมัครหรือซื้อ",
      ],
      [
        "ユーザーガイド、内容ルール、料金表示、返金案内は、それぞれの対象事項について本規約を補足します。特定の注文について明示された条件はその注文に適用されます。矛盾がある場合でも、法令上保護される消費者の権利を不当に制限する解釈は行いません。",
        "使用指南、內容規則、價格標示及退款說明，就各自事項補充本協議。特定訂單明示的條件適用於該訂單。如各項說明不一致，不應以解釋衝突的方式不當減損依法受保障的消費者權利。",
        "The guide, content rules, displayed pricing and refund information supplement these terms on their respective subjects. Conditions expressly shown for a particular order apply to that order. Inconsistencies must not be resolved in a way that improperly removes consumer rights protected by applicable law.",
        "คู่มือ กฎเนื้อหา ราคาที่แสดง และข้อมูลคืนเงินเสริมข้อกำหนดในเรื่องที่เกี่ยวข้อง เงื่อนไขที่ระบุชัดสำหรับคำสั่งซื้อหนึ่งใช้กับคำสั่งซื้อนั้น หากข้อมูลขัดกัน จะไม่ตีความเพื่อตัดสิทธิผู้บริโภคที่กฎหมายคุ้มครองโดยมิชอบ",
      ],
    ],
    account: [
      [
        "登録情報は正確かつ更新可能なものを提供し、メールを管理できなくなった場合は早めにご相談ください。パスワードや認証コードを第三者と共有しないでください。端末の紛失、不正ログイン又は認証情報の漏えいが疑われる場合は、利用を見直し、サポートへ連絡してください。",
        "註冊資料應正確並保持可更新。若不再能管理註冊信箱，請儘早聯絡。請勿分享密碼或驗證碼；如裝置遺失、疑似未經授權登入或登入資料外洩，應及時採取保護措施並聯絡客服。",
        "Provide accurate registration information and keep it up to date. Contact support promptly if you lose control of your registration email. Do not share passwords or verification codes. If a device is lost or unauthorized access or credential exposure is suspected, take protective steps and notify support.",
        "ให้ข้อมูลสมัครที่ถูกต้องและอัปเดตได้ ติดต่อโดยเร็วหากควบคุมอีเมลสมัครไม่ได้ อย่าแบ่งปันรหัสผ่านหรือรหัสยืนยัน หากอุปกรณ์หาย สงสัยว่าถูกเข้าใช้โดยไม่ได้รับอนุญาต หรือข้อมูลเข้าสู่ระบบรั่ว ควรป้องกันและแจ้งเจ้าหน้าที่",
      ],
      [
        "アカウントを通じた操作については、実際の権限、認証状況及び問題の原因を確認します。盗用による決済等の申告を、ログイン済みだったことだけを理由に一律に拒否するものではありません。不正な複数登録、招待報酬の循環取得又は資格の偽装は禁止します。",
        "帳戶操作的爭議會按實際授權、驗證情況及原因查核，不會僅因當時已登入就一概拒絕非本人付款等申訴。不得以虛假帳戶、循環邀請、身分偽裝等方式重複取得獎勵或不當權益。",
        "Account disputes are reviewed using the actual authorization, authentication circumstances and cause of the issue. Being signed in does not automatically defeat a report of an unauthorized payment. False registrations, circular referrals and identity misrepresentation to obtain repeated rewards or improper benefits are prohibited.",
        "ข้อพิพาทบัญชีพิจารณาจากการอนุญาต การยืนยันตัวตน และสาเหตุจริง การอยู่ในระบบไม่ใช่เหตุปฏิเสธคำร้องเรื่องจ่ายเงินโดยไม่ได้อนุญาตทั้งหมด ห้ามสมัครเท็จ เชิญวน หรือแอบอ้างตัวตนเพื่อรับรางวัลซ้ำหรือสิทธิที่ไม่สมควร",
      ],
    ],
    "content-ip": [
      [
        "投稿内容について、当方に必要な利用権限を与えられることを確認してください。当方への許諾は、サービスの保存、表示、送信、必要な形式変換、障害復旧等の運営目的に限られ、所有権の移転を意味しません。外部の AI 処理に必要な送信はプライバシーポリシーに従います。",
        "您應確保有權就提交內容授予必要使用權。平台取得的授權限於儲存、展示、傳輸、必要格式轉換及故障復原等服務運作目的，不代表內容所有權轉移。為完成 AI 處理而向外部服務傳送資料，另依隱私政策處理。",
        "You must have the rights needed to permit processing of your submissions. Our permission is limited to operating the service, including storage, display, transmission, necessary format conversion and recovery. It does not transfer ownership to us. Transmission needed for external AI processing is also subject to the Privacy Policy.",
        "คุณต้องมีสิทธิอนุญาตให้ประมวลผลเนื้อหาที่ส่ง การอนุญาตของเราจำกัดเพื่อดำเนินบริการ เช่น จัดเก็บ แสดง ส่ง แปลงรูปแบบที่จำเป็น และกู้ระบบ ไม่ใช่การโอนกรรมสิทธิ์ การส่งไปประมวลผล AI ภายนอกอยู่ภายใต้นโยบายความเป็นส่วนตัวด้วย",
      ],
      [
        "生成内容が他の利用者の出力と似る場合があります。公開・配布・商用利用の前に、ご自身で事実性及び第三者の著作権、商標権、肖像権等を確認してください。権利が成立するか、第三者の権利を侵害しないかを当方が一律に保証するものではありません。",
        "生成內容可能與其他使用者取得的結果相似。公開、散布或商業使用前，請自行核對事實及第三方著作權、商標、肖像等權利。平台不統一保證每份輸出均具有專屬權利或完全不涉及第三方權利。",
        "Generated results may resemble results provided to others. Before publication, distribution or commercial use, review factual accuracy and relevant copyright, trademark, likeness and other third-party rights. We do not promise exclusive rights in every output or a universal absence of third-party claims.",
        "ผลลัพธ์อาจคล้ายกับที่ผู้อื่นได้รับ ก่อนเผยแพร่ แจกจ่าย หรือใช้เชิงพาณิชย์ โปรดตรวจข้อเท็จจริง ลิขสิทธิ์ เครื่องหมายการค้า ภาพบุคคล และสิทธิอื่นของบุคคลภายนอก เราไม่รับรองสิทธิผูกขาดในทุกผลลัพธ์หรือว่าไม่มีข้อเรียกร้องจากผู้อื่นเสมอไป",
      ],
    ],
    "prompt-assets": [
      [
        "作品の公開を選んだ場合でも、設定原文の抽出や外部配布まで他者に許可したことにはなりません。公開表示された部分と非公開の設定を区別してください。他人のアカウントへのアクセス、制限の回避又は技術的な手段による取得を、閲覧権限の代わりに利用してはなりません。",
        "公開作品不代表允許他人提取設定原文或在站外散布。請區分公開展示資訊與非公開設定；不得以登入他人帳戶、繞過限制或技術性擷取等方式，代替原本不具備的查閱權限。",
        "Making a work public does not by itself authorize extraction of its private settings or redistribution outside the service. Distinguish public presentation from private configuration. Access to another account, circumvention or technical extraction must not be used as a substitute for permission you do not have.",
        "การเผยแพร่ผลงานไม่ใช่การอนุญาตให้ดึงการตั้งค่าส่วนตัวหรือแจกจ่ายนอกบริการ แยกข้อมูลที่แสดงสาธารณะจากการตั้งค่าส่วนตัว ห้ามใช้บัญชีผู้อื่น หลบข้อจำกัด หรือดึงข้อมูลทางเทคนิคแทนสิทธิที่ตนไม่มี",
      ],
    ],
    conduct: [
      [
        "サービス妨害、脆弱性の悪用、認証や課金の回避、悪意のあるコードの配布、なりすまし、不正な報酬取得及び他人の権利侵害を行ってはなりません。通常の利用を妨げる大量の自動要求やデータ取得も禁止します。問題を発見した場合は、拡散や追加の侵入を行わず、対象と再現情報をご連絡ください。",
        "不得干擾服務、利用漏洞、繞過驗證或扣費、散布惡意程式、冒用身分、違規取得獎勵或侵害他人權利。不得以大量自動請求或擷取妨礙正常使用。發現問題時，請提供位置及重現資訊，不應擴散資料或繼續未授權存取。",
        "Do not disrupt service, exploit vulnerabilities, evade authentication or charging, distribute malicious code, impersonate others, abuse rewards or violate others’ rights. High-volume automated requests or extraction that interfere with normal use are prohibited. Report vulnerabilities with their location and reproduction details without spreading data or continuing unauthorized access.",
        "ห้ามรบกวนบริการ ใช้ช่องโหว่ หลบการยืนยันหรือคิดเงิน แจกมัลแวร์ แอบอ้าง ใช้รางวัลผิดทาง หรือละเมิดสิทธิผู้อื่น ห้ามส่งคำขออัตโนมัติหรือดึงข้อมูลจำนวนมากจนรบกวนการใช้ปกติ หากพบช่องโหว่ ให้แจ้งตำแหน่งและวิธีเกิดโดยไม่เผยแพร่ข้อมูลหรือเข้าถึงต่อโดยไม่ได้รับอนุญาต",
      ],
    ],
    moderation: [
      [
        "制限の範囲は、問題の性質、影響及び確認できた情報に応じて判断します。緊急性がある場合は先に停止し、その後確認することがあります。異議の申出には、対象作品や操作、通知内容、事実関係及び希望する対応を記載してください。申出だけで自動的に制限解除となるものではありません。",
        "限制範圍會按問題性質、影響及可核實資料判斷。遇到緊急風險時，可能先暫停後查核。申訴請提供相關作品或操作、收到的通知、事實說明及希望的處理方式；提出申訴不代表限制必定自動解除。",
        "The scope of restrictions depends on the nature, impact and verified facts of an issue. Urgent risks may require temporary restriction before review. An appeal should identify the work or action, any notice received, relevant facts and the requested remedy. Filing an appeal does not automatically remove a restriction.",
        "ขอบเขตการจำกัดขึ้นกับลักษณะ ผลกระทบ และข้อเท็จจริงที่ตรวจได้ ความเสี่ยงเร่งด่วนอาจต้องจำกัดชั่วคราวก่อนตรวจ คำอุทธรณ์ควรระบุผลงานหรือการกระทำ หนังสือแจ้ง ข้อเท็จจริง และสิ่งที่ขอ การยื่นไม่ได้ยกเลิกข้อจำกัดโดยอัตโนมัติ",
      ],
    ],
    ai: [
      [
        "キャラクターの発言は架空の生成結果であり、実在する人物の意思、専門家の判断又は当方の公式見解を示すものではありません。事実の誤り、不適切な内容、文脈の取り違え及び不完全な応答が生じる場合があります。健康、法律、金銭等の重要な判断を、生成結果だけに依存しないでください。",
        "角色發言是虛構的生成結果，不代表真人意願、專業判斷或本公司的正式意見。輸出可能有事實錯誤、不適當內容、誤解上下文或不完整回覆。涉及健康、法律、金錢等重要決定，不應只依賴 AI 輸出。",
        "Character speech is fictional generated content, not a real person’s intentions, professional judgment or an official company position. Outputs can be inaccurate, inappropriate, contextually mistaken or incomplete. Do not rely solely on generated results for important health, legal, financial or similar decisions.",
        "คำพูดตัวละครเป็นผลลัพธ์สมมติ ไม่ใช่เจตนาคนจริง คำวินิจฉัยผู้เชี่ยวชาญ หรือความเห็นทางการของบริษัท ผลลัพธ์อาจผิด ไม่เหมาะสม เข้าใจบริบทผิด หรือไม่ครบ อย่าใช้ผลลัพธ์เพียงอย่างเดียวตัดสินเรื่องสุขภาพ กฎหมาย เงิน หรือเรื่องสำคัญคล้ายกัน",
      ],
      [
        "モデルの提供状況、応答速度、出力形式及び必要な利用単位は変更される場合があります。状態表示や過去の成功は次の要求の成功を保証しません。一方、表示された有料機能が提供されなかった場合等の申告は、AI の確率性だけを理由に確認対象から除外しません。",
        "模型供應情況、速度、輸出格式及所需幣數可能變動。狀態標示及過往成功不保證下一次請求成功。但已顯示並收費的服務未提供等問題，不會僅以「AI 有隨機性」為由拒絕查核。",
        "Model availability, speed, output formats and required units can change. Status indicators and previous success do not guarantee the next request. However, a complaint that a charged service was not delivered will not be excluded from review merely because AI is probabilistic.",
        "ความพร้อมโมเดล ความเร็ว รูปแบบ และหน่วยที่ใช้เปลี่ยนได้ สถานะกับความสำเร็จครั้งก่อนไม่รับประกันครั้งถัดไป แต่คำร้องว่าบริการที่หักเงินแล้วไม่ได้รับ จะไม่ถูกตัดออกจากการตรวจเพียงเพราะ AI มีความน่าจะเป็น",
      ],
    ],
    payments: [
      [
        "購入前に商品内容、幣種、金額、付与数、有効期間及び利用条件を確認してください。決済事業者の承認と当方での入金確認後に注文に対応する特典を付与します。購入後に価格が変わっただけで、以前の注文額が自動的に変更されることはありません。",
        "購買前請確認商品內容、幣別、金額、發放數量、期限及使用條件。支付商核准並由平台確認款項後，按訂單發放權益。後續調價不會自動改變先前訂單的成交金額。",
        "Before purchasing, review the product, currency, amount, allocation, duration and conditions. Benefits are allocated after provider approval and payment confirmation. A later price change does not automatically change the amount agreed for an earlier order.",
        "ก่อนซื้อ ตรวจสินค้า สกุลเงิน ยอด จำนวนสิทธิ ระยะเวลา และเงื่อนไข สิทธิจะให้หลังผู้ให้บริการอนุมัติและยืนยันการจ่าย การเปลี่ยนราคาภายหลังไม่เปลี่ยนยอดที่ตกลงในคำสั่งซื้อก่อนหน้าโดยอัตโนมัติ",
      ],
      [
        "誤請求、重複請求、未付与、不正利用又はサービス提供不能については返金案内に従ってご連絡ください。支払争議の申立てを行った場合は、二重返金を防ぐため関連する手続の状況をお知らせください。適法な返金請求や決済事業者への申立てを妨げるものではありません。",
        "錯誤或重複扣款、權益未發放、非本人交易或服務無法提供等，請依退款說明申請。如已向支付商提出交易爭議，也請告知進度以避免重複退款。本條不限制依法提出退款或向支付商申訴的權利。",
        "Report incorrect or duplicate charges, missing benefits, unauthorized transactions or nondelivery under the Refund Policy. If you have opened a payment dispute, tell us its status so the same payment is not refunded twice. This does not restrict lawful refund claims or access to provider dispute procedures.",
        "แจ้งการหักผิดหรือซ้ำ ไม่ได้รับสิทธิ ธุรกรรมไม่ได้อนุญาต หรือไม่ได้รับบริการตามนโยบายคืนเงิน หากเปิดข้อพิพาทกับผู้ให้บริการแล้ว โปรดแจ้งสถานะเพื่อไม่คืนซ้ำ ข้อนี้ไม่จำกัดการขอคืนตามกฎหมายหรือกระบวนการข้อพิพาทของผู้ให้บริการ",
      ],
    ],
    copyright: [
      [
        "申告には、権利者又は代理人の連絡先、対象となる権利や作品、問題箇所の URL、権利侵害と考える理由、代理権の説明及び申告内容が正確である旨を含めてください。第三者の不要な個人情報を添えないでください。必要に応じて相手方の説明を確認し、誤った申告や悪意のある権利主張についても調査します。",
        "投訴請列明權利人或代理人的聯絡資料、所主張的權利或作品、問題位置的網址、涉嫌侵權的理由、代理權說明及資料屬實的確認。請勿提交無關第三方個資。平台可要求補件、核對另一方說明，並查核錯誤或惡意的權利主張。",
        "An infringement notice should identify the rights holder or agent, contact information, the rights or work concerned, relevant URLs, the basis of the claim, any authority to act and confirmation that the information is accurate. Avoid unrelated third-party personal data. We may seek further evidence, consider a response and investigate mistaken or abusive claims.",
        "คำแจ้งละเมิดควรระบุผู้ถือสิทธิหรือตัวแทน ข้อมูลติดต่อ สิทธิหรือผลงาน URL เหตุผล อำนาจตัวแทน และยืนยันข้อมูลถูกต้อง อย่าส่งข้อมูลส่วนบุคคลที่ไม่เกี่ยวข้อง เราอาจขอหลักฐานเพิ่ม ฟังคำชี้แจงอีกฝ่าย และตรวจคำร้องผิดพลาดหรือใช้สิทธิกลั่นแกล้ง",
      ],
    ],
    liability: [
      [
        "サービスは提供時点の機能及び利用可能な構成で提供します。常時接続、完全な無欠陥、すべての端末との互換性又は特定の創作成果を約束するものではありません。この説明は、購入時に明示した機能、説明との重要な相違又は当方の責任による不履行を免責する趣旨ではありません。",
        "服務按當時提供的功能及可用配置運作，不承諾永不中斷、完全無瑕疵、適用所有裝置或一定達到特定創作效果。此說明不免除購買時明示功能、與說明重大不符或平台責任造成未履行等事項應負的責任。",
        "The service is provided with the features and available configuration offered at the time. We do not promise uninterrupted operation, complete absence of defects, compatibility with every device or a particular creative result. This does not excuse an expressly sold feature, a material mismatch with its description or a failure for which we are responsible.",
        "บริการให้ตามฟังก์ชันและระบบที่พร้อมในขณะนั้น เราไม่สัญญาว่าจะไม่หยุด ไม่มีข้อบกพร่อง ใช้ได้ทุกอุปกรณ์ หรือได้ผลสร้างสรรค์เฉพาะ ข้อนี้ไม่ยกเว้นความรับผิดเรื่องฟังก์ชันที่ขายไว้อย่างชัดเจน ความต่างสำคัญจากคำอธิบาย หรือการไม่ให้บริการที่เราเป็นผู้รับผิดชอบ",
      ],
      [
        "損害や返金の請求は、原因、因果関係、実際の損害及び適用法に基づき確認します。利用者にも、問題の拡大を避ける合理的な協力をお願いする場合があります。故意、重大な過失その他法令で免責を禁止される責任や救済を、本規約によって排除しません。",
        "損害或退款請求將按原因、因果關係、實際損失及適用法律查核；必要時可請使用者合理協助，避免損害擴大。本協議不排除故意、重大過失或其他依法不得排除的責任與救濟。",
        "Claims for loss or refunds are assessed by cause, causation, actual loss and applicable law. Reasonable cooperation to prevent avoidable escalation may be requested. Nothing here excludes liability or remedies for deliberate misconduct, gross negligence or other matters that applicable law does not allow us to exclude.",
        "คำร้องค่าเสียหายหรือคืนเงินพิจารณาสาเหตุ ความเกี่ยวเนื่อง ความเสียหายจริง และกฎหมาย อาจขอความร่วมมือสมควรเพื่อไม่ให้เสียหายเพิ่ม ข้อกำหนดไม่ตัดความรับผิดหรือการเยียวยาเรื่องเจตนามิชอบ ประมาทร้ายแรง หรือสิ่งที่กฎหมายไม่ให้ยกเว้น",
      ],
    ],
    law: [
      [
        "まず、注文番号又は関連画面と請求内容を添えて、サポートへ解決をお申し出ください。協議で解決しない場合、法令上認められる裁判所その他の紛争解決窓口を利用できます。特定の外国の仲裁、遠隔地での専属管轄又は法定の申立期限より短い一律の期限を、この規約で新たに義務付けるものではありません。",
        "發生爭議時，可先附訂單編號或相關畫面及訴求向客服申請處理；協商未能解決時，可使用依法有權受理的法院或其他爭議處理機制。本協議未另行強制指定外國仲裁、遙遠地區的專屬法院，或統一縮短法定申訴期限。",
        "You may first seek resolution through support with the order ID or relevant screen and the remedy requested. If discussion does not resolve a dispute, courts or other dispute channels legally competent to handle it remain available. These terms do not impose foreign arbitration, an exclusive distant forum or a blanket shortened statutory claim period.",
        "เมื่อมีข้อพิพาท ติดต่อพร้อมหมายเลขคำสั่งซื้อหรือภาพและสิ่งที่ขอก่อนได้ หากตกลงไม่ได้ ยังใช้ศาลหรือช่องทางที่มีอำนาจตามกฎหมายได้ ข้อกำหนดนี้ไม่บังคับอนุญาโตตุลาการต่างประเทศ ศาลเฉพาะที่ห่างไกล หรือย่นเวลายื่นตามกฎหมายแบบครอบคลุม",
      ],
    ],
    termination: [
      [
        "停止又は退会後も、既に成立した注文、未解決の返金、権利侵害、法令に基づく保存及び紛争解決に必要な規定は、その目的に必要な範囲で適用されます。退会は支払義務又は法定の返金権利を自動的に消滅させるものではありません。退会前に必要な記録を保存し、未解決の請求をご相談ください。",
        "停止使用或註銷後，已成立的訂單、未處理退款、侵權事項、法定保存及爭議處理所需條款，仍於其目的所需範圍內適用。註銷不會自動消滅既有付款義務或法定退款權利。請先保存所需記錄，並處理尚未解決的款項問題。",
        "After suspension or deletion, provisions needed for existing orders, unresolved refunds, rights claims, legally required retention and dispute resolution continue only to the extent needed for those purposes. Deletion does not automatically erase payment obligations or statutory refund rights. Save needed records and raise unresolved billing matters before deleting.",
        "หลังระงับหรือลบบัญชี เงื่อนไขที่จำเป็นต่อคำสั่งซื้อเดิม คืนเงินที่ยังไม่จบ ข้อเรียกร้องสิทธิ การเก็บตามกฎหมาย และข้อพิพาท ยังคงใช้เท่าที่จำเป็น การลบไม่ล้างหน้าที่จ่ายหรือสิทธิคืนตามกฎหมายอัตโนมัติ โปรดเก็บบันทึกและแจ้งปัญหาค้างก่อนลบ",
      ],
    ],
    misc: [
      [
        "一部の条項が無効と判断されても、他の適法な条項は引き続き適用されます。権利を直ちに行使しないことは、その権利を永久に放棄することを意味しません。事業の承継等で契約を移転する場合は、必要な告知を行い、既存の注文や個人情報について負う義務を不当に回避しません。",
        "部分條款如被認定無效，其餘合法條款仍繼續適用。未立即行使權利，不代表永久放棄該權利。如因業務承接等移轉契約，應作必要告知，不得藉此不當迴避既有訂單或個人資料應負的義務。",
        "If one provision is invalid, the remaining lawful provisions continue to apply. A delay in enforcing a right is not a permanent waiver. If a business transfer involves assignment of service obligations, required notices will be given and the transfer must not improperly evade duties for existing orders or personal data.",
        "หากข้อหนึ่งใช้ไม่ได้ ข้อที่ชอบด้วยกฎหมายอื่นยังใช้ต่อ การไม่บังคับสิทธิทันทีไม่ใช่สละถาวร หากโอนกิจการแล้วต้องโอนหน้าที่บริการ จะให้คำแจ้งที่จำเป็นและไม่ใช้การโอนเพื่อเลี่ยงหน้าที่ต่อคำสั่งซื้อเดิมหรือข้อมูลส่วนบุคคลโดยมิชอบ",
      ],
    ],
    contact: [
      [
        "一般の操作相談、支払・返金、個人情報、権利侵害では確認する資料が異なります。件名で相談の種類を示し、登録メール、対象 URL、注文又は発生日時等、必要な情報に絞って送ってください。当方が本人確認のために追加情報を求める場合も、パスワードや決済認証コードは求めません。",
        "一般操作、付款退款、個資及侵權問題需要的查核資料不同，請於主旨註明類型，並按需要提供帳戶信箱、網址、訂單或發生時間。平台可能另行核實身分，但不會索取密碼或付款驗證碼。",
        "Usage, payment, privacy and infringement requests need different evidence. Identify the request category in the subject and provide only relevant account email, URL, order or event details. Additional identity checks may be needed, but support will not request passwords or payment verification codes.",
        "คำถามการใช้ ชำระเงิน ข้อมูลส่วนตัว และละเมิดสิทธิ ใช้หลักฐานต่างกัน ระบุประเภทในหัวข้อและส่งเฉพาะอีเมล URL คำสั่งซื้อ หรือเหตุการณ์ที่เกี่ยวข้อง อาจต้องตรวจตัวตนเพิ่ม แต่จะไม่ขอรหัสผ่านหรือรหัสยืนยันจ่าย",
      ],
    ],
  },
  "privacy-policy": {
    definitions: [
      [
        "本ポリシーは当サイトにおける個人情報の取扱いを説明するもので、外部リンク先の事業者が自ら決める取扱いには、その事業者の説明も適用されます。第三者のために入力する場合は、適切な権限又は必要な同意があることを確認してください。会話には他人の機密情報を入力しないでください。",
        "本政策說明本站的個人資料處理。外部連結所到網站自行決定的處理方式，另以該供應商說明為準。如替他人輸入資料，應確保具備適當權限或所需同意；請勿在對話中提交他人的機密資料。",
        "This policy explains processing by this website. Independent processing on linked services is also governed by their own disclosures. When providing information about another person, ensure that you have appropriate authority or any required consent. Do not put another person’s confidential information into a conversation.",
        "นโยบายนี้อธิบายการประมวลผลของเว็บนี้ การประมวลผลที่บริการเชื่อมโยงตัดสินใจเองอยู่ภายใต้คำชี้แจงของเขาด้วย หากส่งข้อมูลผู้อื่น ต้องมีอำนาจหรือความยินยอมที่จำเป็น อย่าใส่ข้อมูลลับผู้อื่นในบทสนทนา",
      ],
    ],
    collect: [
      [
        "登録・アカウント管理ではメール、表示名、利用者名、プロフィール及び認証に必要な情報を処理します。機能の利用に伴い、作品、面具、会話履歴、設定、保存・削除操作等のデータが生じます。問い合わせを行う場合は、送信した連絡内容、注文情報及び問題の調査資料を処理します。",
        "註冊及帳戶管理涉及信箱、顯示名稱、使用者名稱、個人資料及驗證所需資訊。使用功能時會產生作品、面具、對話記錄、偏好及保存或刪除操作等資料。聯絡客服時，另處理您提交的聯絡內容、訂單與查核資料。",
        "Account administration involves email, display name, username, profile and information needed for authentication. Feature use creates works, personas, conversations, preferences and records of save or deletion actions. Support requests involve the correspondence, order information and investigation material you submit.",
        "การจัดการบัญชีใช้ข้อมูลอีเมล ชื่อแสดง ชื่อผู้ใช้ โปรไฟล์ และข้อมูลยืนยัน การใช้ฟังก์ชันก่อให้เกิดผลงาน หน้ากาก บทสนทนา การตั้งค่า และบันทึกการบันทึกหรือลบ การติดต่อใช้ข้อความ ข้อมูลคำสั่งซื้อ และหลักฐานที่คุณส่ง",
      ],
      [
        "取引では注文番号、商品、金額、幣種、支払状態、付与及び返金記録等を処理します。端末や接続からは IP、ブラウザー、要求日時、エラー及び不正利用対策に必要なログが生じる場合があります。カードの入力は決済事業者の画面で行い、当サイトでカードの暗証番号や完全なカード情報を収集するよう依頼しません。",
        "交易資料包含訂單編號、商品、金額、幣別、付款狀態、發放及退款記錄等。連線可能產生 IP、瀏覽器、請求時間、錯誤及防濫用所需日誌。卡片資料應在支付商頁面填寫，本站不會要求提供卡片密碼或完整卡片資料。",
        "Transaction records include order IDs, products, amounts, currency, payment status, allocations and refunds. Connections may create IP, browser, request-time, error and anti-abuse logs. Card details should be entered on the payment provider’s page; this website does not ask you to submit a card PIN or complete card credentials to support.",
        "ข้อมูลธุรกรรมรวมหมายเลขคำสั่งซื้อ สินค้า ยอด สกุลเงิน สถานะ การให้สิทธิ และคืนเงิน การเชื่อมต่ออาจสร้าง IP เบราว์เซอร์ เวลา ข้อผิดพลาด และบันทึกป้องกันใช้ผิด ควรกรอกข้อมูลบัตรบนหน้าผู้ให้บริการจ่าย เว็บไม่ขอ PIN หรือข้อมูลรับรองบัตรทั้งหมดผ่านเจ้าหน้าที่",
      ],
    ],
    cookies: [
      [
        "ログイン状態、言語、表示上の好み等を保持するため、Cookie 又は同等のローカル保存を使用します。ブラウザーから削除・制限できますが、ログインの維持等が使えなくなる場合があります。Cookie を消してもサーバー上のアカウントや注文が自動削除されるわけではありません。追加の任意計測を導入する場合は、必要な説明や選択手段を整えます。",
        "Cookie 或類似本機儲存用於維持登入、語言及顯示偏好等。您可透過瀏覽器刪除或限制，但可能無法保持登入。清除 Cookie 不會自動刪除伺服器上的帳戶或訂單。如日後增加需由您選擇的非必要追蹤，會提供相應說明及選擇方式。",
        "Cookies or comparable local storage maintain sign-in, language and display preferences. Browser controls can remove or restrict them, which may prevent persistent sign-in. Clearing cookies does not delete server-side accounts or orders. If additional optional tracking is introduced, appropriate information and choices will be provided.",
        "คุกกี้หรือที่เก็บในเครื่องรักษาการเข้าสู่ระบบ ภาษา และการแสดงผล ลบหรือจำกัดผ่านเบราว์เซอร์ได้ แต่อาจคงการเข้าใช้ไม่ได้ การล้างคุกกี้ไม่ลบบัญชีหรือคำสั่งซื้อบนเซิร์ฟเวอร์ หากเพิ่มการติดตามเสริมที่ต้องเลือก จะให้ข้อมูลและทางเลือกที่เหมาะสม",
      ],
    ],
    "ai-processing": [
      [
        "応答を生成するため、選択したモデル又は中継サービスに、要求に必要な会話、キャラクター設定、利用中の面具及び関連文脈を送信する場合があります。入力したすべての履歴が必ず毎回そのまま送られるわけではなく、機能や文脈長に応じて選択・整理される場合があります。不要な個人情報は入力しないでください。",
        "為生成回覆，可能向所選模型或中轉服務傳送請求所需的對話、角色設定、目前面具及相關上下文。不是每次都原樣傳送全部歷史，實際內容會依功能與上下文長度選取、整理。請避免輸入不必要的個資。",
        "To generate a response, the selected model or intermediary may receive conversation text, character settings, the active persona and related context necessary for the request. The entire history is not necessarily sent unchanged on every request; selection and organization depend on the feature and context limits. Avoid unnecessary personal data in prompts.",
        "เพื่อสร้างคำตอบ โมเดลหรือตัวกลางที่เลือกอาจรับบทสนทนา การตั้งค่าตัวละคร หน้ากากปัจจุบัน และบริบทที่จำเป็น ไม่จำเป็นต้องส่งประวัติทั้งหมดแบบเดิมทุกครั้ง การเลือกและจัดขึ้นกับฟังก์ชันและขีดจำกัดบริบท โปรดหลีกเลี่ยงข้อมูลส่วนตัวที่ไม่จำเป็น",
      ],
      [
        "当方が自社モデルを学習させないことは、外部提供者がデータを一切保存しないという保証ではありません。外部処理には提供者ごとの契約、ログ、安全対策及び保存方針が関係します。当方への請求によって、外部提供者の既存の適法な保存を直ちに削除できると約束するものではなく、対応可能な範囲を確認してご案内します。",
        "平台不訓練自有模型，不等於外部供應商完全不保存資料。外部處理涉及各供應商的契約、日誌、安全措施及保存規則。向平台提出請求，不代表可立即刪除外部供應商一切合法留存；我們會查核可處理範圍並告知。",
        "Our not training our own models does not guarantee that every external provider keeps no data. External processing depends on provider contracts, logs, safeguards and retention practices. A request to us does not guarantee immediate erasure of every lawful record held by a provider; we will assess what action is available and explain the scope.",
        "การที่เราไม่ฝึกโมเดลของตน ไม่รับประกันว่าผู้ให้บริการภายนอกไม่เก็บข้อมูลเลย การประมวลผลขึ้นกับสัญญา บันทึก มาตรการ และระยะเก็บของแต่ละราย การขอเราลบไม่รับประกันลบบันทึกที่ภายนอกเก็บโดยชอบได้ทันที เราจะตรวจขอบเขตที่ทำได้และแจ้งให้ทราบ",
      ],
    ],
    share: [
      [
        "情報は、認証、ホスティング、AI 処理、メール、決済、サポート等を担う事業者に、各業務に必要な範囲で提供します。法的な要請、安全上の問題又は事業承継に関係して提供が必要になる場合は、法的根拠、必要性及び影響を確認します。秘密の会話を、他の利用者への公開表示だけを目的として無断で公開することはありません。",
        "資料按認證、託管、AI 處理、郵件、支付、客服等用途，在必要範圍內提供予負責供應商。如因法律要求、安全事項或業務承接需提供，會按法律依據、必要性及影響處理。平台不會僅為向其他使用者展示而擅自公開您的私密對話。",
        "Information is shared as needed with providers handling authentication, hosting, AI processing, email, payments and support. Disclosures concerning legal requests, safety or a business transfer are assessed for legal basis, necessity and impact. Private conversations are not published without authorization merely to display them to other users.",
        "แบ่งปันเท่าที่จำเป็นกับผู้ดูแลยืนยันตัวตน โฮสต์ AI อีเมล จ่ายเงิน และช่วยเหลือ การเปิดเผยตามคำขอกฎหมาย ความปลอดภัย หรือโอนธุรกิจ พิจารณาฐานกฎหมาย ความจำเป็น และผลกระทบ จะไม่เผยแพร่บทสนทนาส่วนตัวโดยไม่ได้อนุญาตเพียงเพื่อแสดงแก่ผู้ใช้อื่น",
      ],
    ],
    subprocessors: [
      [
        "画面に表示されたブランド名と、実際に要求を処理する API・中継事業者が同じ法人とは限りません。支払ページや外部リンクの利用に際しては、その事業者の案内も確認してください。個別の要求に関する照会は、発生日時、モデル名又は注文番号を添えてご連絡いただくと、処理経路の確認に役立ちます。",
        "畫面顯示的模型品牌與實際接收請求的 API 或中轉公司，不一定是同一法人。使用支付頁或外部連結時，也請查閱該供應商說明。查詢特定請求時，提供發生時間、模型或訂單編號，有助核對處理渠道。",
        "A displayed model brand and the API or intermediary actually receiving a request are not necessarily the same legal entity. Consult the provider information on payment pages or linked services. Event time, model name or order ID helps us investigate the processing route for a particular request.",
        "ชื่อแบรนด์โมเดลบนจอกับนิติบุคคล API หรือตัวกลางที่รับคำขอจริงอาจไม่ใช่รายเดียวกัน โปรดอ่านข้อมูลผู้ให้บริการบนหน้าชำระหรือเว็บเชื่อมโยง เวลาเหตุการณ์ ชื่อโมเดล หรือหมายเลขคำสั่งซื้อช่วยตรวจเส้นทางการประมวลผลเฉพาะรายการได้",
      ],
    ],
    protect: [
      [
        "必要な担当者へのアクセス制御、認証、ログ及び障害対応等により情報を保護します。利用者にも端末と認証情報の管理をお願いします。漏えい等が疑われる場合は、その範囲と影響を確認して封じ込め・是正を行い、必要な通知を適用法に従って行います。安全対策があることを、事故の可能性がないという保証とは解釈しないでください。",
        "平台透過人員權限控制、驗證、日誌及故障處理等措施保護資料，使用者亦須保護裝置與登入資訊。如疑似外洩，會查核範圍及影響、採取控制與修正措施，並依適用法律作必要通知。安全措施並不等於承諾絕無事故。",
        "Access controls, authentication, logs and incident response help protect information. You should also protect devices and credentials. A suspected exposure will be assessed for scope and impact, contained and remedied as appropriate, with notifications required by applicable law. Safeguards are not a guarantee that no incident can occur.",
        "ควบคุมสิทธิเจ้าหน้าที่ ยืนยันตัวตน บันทึก และจัดการเหตุการณ์ช่วยปกป้องข้อมูล คุณควรปกป้องอุปกรณ์กับข้อมูลเข้าใช้ด้วย หากสงสัยข้อมูลรั่ว จะตรวจขอบเขตและผลกระทบ ควบคุมและแก้ตามสมควร พร้อมแจ้งตามกฎหมาย มาตรการไม่รับประกันว่าไม่มีเหตุได้เลย",
      ],
    ],
    store: [
      [
        "保存期間は、アカウントの継続、機能提供、注文・税務、紛争、不正対策及びバックアップ等の目的で異なります。利用者が消した表示内容が、復旧用バックアップから同じ瞬間に消えるとは限りません。バックアップを復元する場合は、既に確認された削除要求を不当に無効にしないよう扱います。",
        "保存期間依帳戶維持、功能提供、訂單稅務、爭議、防濫用及備份等用途而異。您刪除展示內容，不代表復原備份在同一時間也立即刪除；如需還原備份，會注意不得不當使已確認的刪除請求失效。",
        "Retention varies for account operation, features, orders and tax records, disputes, abuse prevention and backups. Deleting displayed content does not mean every recovery backup is erased at the same instant. Backup restoration should not improperly override a deletion request already confirmed.",
        "ระยะเก็บต่างกันตามบัญชี ฟังก์ชัน คำสั่งซื้อ ภาษี ข้อพิพาท ป้องกันใช้ผิด และสำรองข้อมูล การลบที่แสดงไม่ทำให้สำรองกู้คืนทุกชุดลบทันที หากกู้สำรอง จะระวังไม่ลบล้างคำขอลบที่ยืนยันแล้วโดยมิชอบ",
      ],
      [
        "国外から利用する場合も、現在説明している保管・処理地域に情報が送られる場合があります。外部事業者を含む処理地域は変更されることがあるため、重要な変更がある場合は説明を更新します。特定地域にのみデータが存在すると、ここで開示した構成を超えて約束するものではありません。",
        "從其他地區使用時，資料仍可能傳送至本政策揭示的儲存或處理地區。包括外部供應商在內的處理地點可能變動，重要變更會更新說明。平台未在上述配置之外保證資料只存在某單一地區。",
        "Use from another country may involve transfer to the storage and processing locations disclosed here. Processing locations, including those of suppliers, can change, and material changes will be reflected in our disclosures. We do not promise that data exists only in one territory beyond the setup described in this policy.",
        "การใช้จากประเทศอื่นอาจส่งข้อมูลไปยังสถานที่เก็บและประมวลผลที่ระบุ จุดประมวลผลรวมผู้จัดหาอาจเปลี่ยน และจะปรับคำชี้แจงเมื่อเปลี่ยนสำคัญ เราไม่สัญญาว่าข้อมูลอยู่เฉพาะเขตเดียวเกินกว่าระบบที่เปิดเผย",
      ],
    ],
    rights: [
      [
        "適用法が認める範囲で、ご自身の情報の確認、訂正、写しの取得、削除、特定処理の制限又は同意の撤回を申し出ることができます。すべての要求に同じ法的権利や技術的方法があるわけではありません。対応できない部分がある場合は、理由又は代替手段をご案内します。権利を行使したことだけを理由に不利益に扱いません。",
        "於適用法律允許範圍內，您可提出查閱、更正、取得副本、刪除、限制特定處理或撤回同意。不是所有請求均適用相同法律權利或技術方式；如有無法處理部分，會說明理由或替代方式。不會僅因您行使權利而作不利處理。",
        "Where applicable law provides them, you may request access, correction, a copy, deletion, restriction of particular processing or withdrawal of consent. Not every request has the same legal basis or technical method. We will explain limitations or alternatives where action is unavailable. Exercising a right alone is not grounds for adverse treatment.",
        "เมื่อกฎหมายให้สิทธิ คุณขอดู แก้ สำเนา ลบ จำกัดบางการประมวลผล หรือถอนยินยอมได้ แต่ละคำขออาจมีฐานกฎหมายและวิธีเทคนิคต่างกัน หากทำไม่ได้จะอธิบายข้อจำกัดหรือทางเลือก การใช้สิทธิเพียงอย่างเดียวไม่ใช่เหตุให้ปฏิบัติไม่เป็นธรรม",
      ],
      [
        "第三者の情報を誤って渡したりアカウントを削除したりしないため、必要かつ相当な本人確認をお願いする場合があります。代理人を通す場合は権限も確認します。確認資料は必要な範囲に絞ってください。他人の会話、法定の保存、不正対策又は紛争記録に関わる場合は、関連する例外を個別に説明します。",
        "為避免誤交他人資料或誤刪帳戶，可能需必要且適度的身分核實；代理申請亦須確認授權。請僅提供所需核實資料。如涉及他人對話、法定保存、防濫用或爭議記錄，會按個案說明適用限制。",
        "Necessary and proportionate identity verification may be required to avoid disclosing someone else’s information or deleting the wrong account. An agent’s authority must also be verified. Submit only necessary evidence. Requests involving others’ conversations, legal retention, abuse prevention or dispute records may be subject to explained exceptions.",
        "อาจต้องตรวจตัวตนเท่าที่จำเป็นและได้สัดส่วน เพื่อไม่ส่งข้อมูลผู้อื่นหรือลบบัญชีผิด ตัวแทนต้องยืนยันอำนาจด้วย ส่งหลักฐานเฉพาะที่ต้องใช้ คำขอเกี่ยวกับบทสนทนาผู้อื่น การเก็บตามกฎหมาย ป้องกันใช้ผิด หรือข้อพิพาทอาจมีข้อยกเว้นที่จะอธิบาย",
      ],
    ],
    minors: [
      [
        "年齢条件を満たさない利用が判明した場合は、関連情報とアカウントを確認し、必要な制限又は削除を行います。保護者等からの申出でも、第三者になりすました削除を防ぐため、合理的な確認が必要な場合があります。学校名、子どもの連絡先等の不要な個人情報を問い合わせに含めないでください。",
        "如發現不符合年齡條件的使用，會查核相關資料及帳戶並作必要限制或刪除。即使由家長提出，亦可能需合理核實，以避免冒名刪除。聯絡時請勿附不必要的學校、孩子聯絡資料等資訊。",
        "If use by someone below the permitted age is identified, we will review the information and account and take appropriate restrictions or deletion measures. A parent’s request may also require reasonable verification to prevent impersonation. Do not include unnecessary school or child contact details in a report.",
        "หากพบผู้ใช้ต่ำกว่าอายุที่กำหนด จะตรวจข้อมูลและบัญชีแล้วจำกัดหรือลบตามสมควร คำขอผู้ปกครองอาจต้องตรวจตามเหตุผลเพื่อป้องกันแอบอ้าง อย่าส่งโรงเรียนหรือข้อมูลติดต่อเด็กที่ไม่จำเป็นในรายงาน",
      ],
    ],
    updates: [
      [
        "重要な変更は更新日とともに示し、必要に応じてサイト内表示等で案内します。将来の新しい目的のために追加の同意等が必要になる場合は、単に古い規約への同意があることだけで済ませません。過去の版に関する照会は、対象日付を添えてご連絡ください。",
        "重要變更會標示更新日期，並按需要透過站內等方式通知。如日後新用途需另行取得同意或提供選擇，不會僅以您曾同意舊政策代替。查詢舊版本時，可提供所涉日期聯絡。",
        "Material changes are dated and communicated through the site or other appropriate means. If a new purpose requires additional consent or a choice, acceptance of an older policy alone will not replace that requirement. Contact us with the relevant date for questions about an earlier version.",
        "การเปลี่ยนสำคัญจะแสดงวันที่และแจ้งในเว็บหรือวิธีเหมาะสม หากวัตถุประสงค์ใหม่ต้องยินยอมหรือเลือกเพิ่ม การยอมรับนโยบายเดิมอย่างเดียวใช้แทนไม่ได้ ติดต่อพร้อมวันที่เกี่ยวข้องหากถามถึงฉบับก่อน",
      ],
    ],
    contact: [
      [
        "個人情報の照会には件名に「個人情報」と記載し、登録メール、対象の情報及び希望する対応を知らせてください。通常の操作問い合わせとは区別して確認します。パスワード、完全なカード情報又は問い合わせに不要な身分証明情報は、最初の連絡時に送らないでください。",
        "個資申請請在主旨註明「個人資料」，提供註冊信箱、所涉資料及希望的處理方式，以便與一般操作問題區分查核。首次聯絡請勿寄送密碼、完整卡片資料或不必要的身分證明。",
        "Use “Privacy” in the subject with your registration email, the information concerned and the action requested so we can distinguish it from a general usage question. Do not include passwords, full card credentials or unnecessary identity documents in an initial message.",
        "ระบุหัวข้อความเป็นส่วนตัว พร้อมอีเมลสมัคร ข้อมูลที่เกี่ยวข้อง และสิ่งที่ขอ เพื่อแยกจากคำถามใช้งานทั่วไป อย่าแนบรหัสผ่าน ข้อมูลรับรองบัตรทั้งหมด หรือเอกสารตัวตนที่ไม่จำเป็นในการติดต่อครั้งแรก",
      ],
    ],
  },
  refund: {
    scope: [
      [
        "本サイトからの直接購入を対象とし、注文単位で支払額と特典の付与・利用を確認します。紹介報酬、チェックイン、キャンペーン等の無料付与は、現金購入と区別します。外部事業者が自ら販売した商品がある場合は、その売主と窓口を確認し、同じ支払について重複した請求を避けてください。",
        "本說明針對本站直接購買，依訂單查核付款金額與權益發放、使用情況。邀請、簽到或活動等免費贈送，與實際付款購買分開處理。如屬外部商家自行銷售的商品，應先核對賣方及處理窗口，避免就同筆款項重複申請。",
        "Direct purchases are reviewed by order, payment amount, benefit allocation and actual usage. Free referral, check-in and promotional grants are distinguished from paid purchases. For a product independently sold by an outside merchant, identify the seller and contact channel and avoid duplicate claims for one payment.",
        "การซื้อโดยตรงตรวจตามคำสั่งซื้อ ยอด สิทธิที่ให้ และการใช้จริง รางวัลเชิญ เช็กอิน หรือแคมเปญฟรีแยกจากสิ่งที่จ่าย หากเป็นสินค้าที่ผู้ค้าภายนอกขายเอง ให้ตรวจผู้ขายและช่องทาง แล้วหลีกเลี่ยงคำขอซ้ำในเงินรายการเดียว",
      ],
    ],
    eligibility: [
      [
        "複数回の引落しが同じ注文に対応するか、支払状態と特典付与が一致するか、利用不能の原因と期間は何か等を確認します。返金が唯一の対応とは限らず、ご希望と法的権利を考慮し、訂正、再付与又は全額・一部返金をご案内します。不正利用の疑いがある場合は、決済事業者への連絡もご検討ください。",
        "查核會包括多次扣款是否為同一訂單、付款與發放是否一致、無法使用的原因及期間等。處理不一定只有退款，也會考慮您的訴求及法定權利，提供更正、補發或全額、部分退款方案。疑似盜刷時，也可聯絡支付商。",
        "Review may check whether multiple charges concern one order, whether payment and delivery agree, and the cause and duration of unavailability. A remedy may be correction, delivery or a full or partial refund, taking account of your request and legal rights. Suspected unauthorized charges may also warrant contacting your payment provider.",
        "อาจตรวจว่าหักหลายครั้งเป็นคำสั่งซื้อเดียวหรือไม่ การจ่ายตรงกับสิทธิหรือไม่ และสาเหตุกับเวลาที่ใช้ไม่ได้ การแก้อาจเป็นแก้รายการ ให้สิทธิ หรือคืนเต็มหรือบางส่วน โดยคำนึงคำขอและสิทธิของคุณ หากสงสัยถูกใช้จ่ายโดยไม่ได้อนุญาต ควรติดต่อผู้ให้บริการจ่ายด้วย",
      ],
    ],
    used: [
      [
        "生成の長さや文体が好みに合わないことだけと、表示された機能が実際に利用できなかったことは区別します。既に消費した部分、残存する期間、未提供部分及び注文時の説明を確認します。返金対象を判断するために、必要以上の私的な会話全文の提出を最初から求めることはありません。",
        "會區分單純不喜歡輸出長短、文風，與已標示功能實際無法使用。查核時參考已使用部分、剩餘期間、未提供部分及下單時說明；不會一開始就要求提交超出必要範圍的整份私密對話。",
        "A preference about output length or style is different from an advertised feature being unavailable. Review considers consumed benefits, remaining duration, undelivered parts and the description at purchase. We do not initially require an unnecessarily broad copy of private conversations merely to assess eligibility.",
        "ความชอบเรื่องความยาวหรือสไตล์ต่างจากฟังก์ชันที่โฆษณาใช้ไม่ได้ การตรวจดูส่วนใช้แล้ว ระยะที่เหลือ ส่วนไม่ได้รับ และคำอธิบายเมื่อซื้อ เราไม่เริ่มด้วยการขอบทสนทนาส่วนตัวทั้งหมดเกินจำเป็นเพื่อพิจารณาสิทธิ",
      ],
    ],
    request: [
      [
        "申請時は、同じ問題について既に行ったお問い合わせや決済紛争の番号があれば併記してください。支払が確認できない場合は、機密部分を隠した領収画面等をお願いすることがあります。注文や取引を照合できる資料を保管し、問題に気づいたら早めにお申し出ください。申請期限については適用法で保障される権利を優先します。",
        "如曾就同一問題聯絡或提出支付爭議，申請時請附相關編號。付款資料無法核對時，可能需提供遮蔽敏感資訊的收據畫面。請保留可核對交易的資料，發現問題後儘早提出；申請期限不減損適用法律保障的權利。",
        "Include existing support or payment-dispute references for the same issue. If payment cannot be matched, a receipt screenshot with sensitive details concealed may be requested. Keep records sufficient to identify the transaction and apply promptly. Any request timing remains subject to rights protected by applicable law.",
        "แนบหมายเลขติดต่อหรือข้อพิพาทเดิมเรื่องเดียวกัน หากจับคู่การจ่ายไม่ได้ อาจขอภาพใบเสร็จที่ปิดข้อมูลอ่อนไหว เก็บบันทึกที่ระบุธุรกรรมได้และแจ้งโดยเร็ว เงื่อนไขเวลายังอยู่ภายใต้สิทธิตามกฎหมาย",
      ],
    ],
    processing: [
      [
        "受付、追加資料の確認、判断結果及び決済側への返金依頼は別の段階です。承認時には対象の注文、金額及び調整する特典をご案内します。銀行やカード会社の処理、休業日又は決済争議中の手続により着金が遅れる場合があります。元の手段に戻せない場合は、安全で適法な代替方法を個別に相談します。",
        "受理、補件核實、判斷結果及向支付商提交退款屬不同階段。核准時會說明所涉訂單、金額及權益調整。銀行、發卡機構、假日或交易爭議程序可能影響到帳；如原付款方式無法退回，會另行商議安全且合法的替代方式。",
        "Receipt, evidence review, a decision and submission to the provider are separate stages. Approval identifies the order, amount and benefit adjustment. Banks, card issuers, non-working days or an open dispute can affect arrival. If the original method cannot receive a return, an appropriate lawful alternative will be discussed individually.",
        "การรับ ตรวจหลักฐาน ตัดสิน และส่งผู้ให้บริการเป็นคนละขั้น เมื่ออนุมัติจะระบุคำสั่งซื้อ ยอด และการปรับสิทธิ ธนาคาร ผู้ออกบัตร วันหยุด หรือข้อพิพาทที่เปิดอยู่อาจกระทบเวลารับ หากทางเดิมรับไม่ได้ จะหารือทางเลือกที่ปลอดภัยและชอบด้วยกฎหมายเป็นรายกรณี",
      ],
    ],
    benefits: [
      [
        "返金済みの注文に対応する特典を、返金後も重複利用することはできません。関連する調整に異議がある場合は、明細と注文番号を添えてご相談ください。一部返金では対象部分と計算の考え方を説明します。異議申立てや正当な返金請求をしたことだけを理由に、無関係な資産を没収するものではありません。",
        "退款訂單所對應的權益，不應於退款後繼續重複使用。如對調整有異議，可附明細與訂單編號提出。部分退款會說明所涉範圍及計算依據；不會僅因合法申請退款或提出爭議而沒收無關權益。",
        "Benefits tied to a refunded order must not be used again after refund. Raise any disagreement about an adjustment with the order and balance records. A partial refund will identify its scope and calculation basis. Unrelated benefits are not forfeited merely because you make a lawful refund claim or dispute.",
        "สิทธิของคำสั่งซื้อที่คืนแล้วต้องไม่ใช้ซ้ำหลังคืน หากโต้แย้งการปรับให้ส่งคำสั่งซื้อกับบันทึกยอด การคืนบางส่วนจะอธิบายขอบเขตและฐานคำนวณ ไม่ริบสิทธิที่ไม่เกี่ยวข้องเพียงเพราะขอคืนหรือยื่นข้อพิพาทโดยชอบ",
      ],
    ],
  },
  billing: {
    products: [
      [
        "商品ページでは、付与される内容、数量、期限及び対応機能を確認してください。画面の金額と決済側の表示に相違がある場合は、支払を進めずお問い合わせください。銀行等の独自の手数料が発生する場合は、その事業者に確認してください。当方が表示していない為替換算や値引きを、決済額に独自に適用できるものではありません。",
        "請在商品頁核對內容、數量、期限與適用功能。若本站金額與支付頁不一致，先勿付款並聯絡查核。銀行等自行收取的費用，請向該機構確認；不得自行把未顯示的換算或折扣套用為應付金額。",
        "Check the product, quantity, duration and eligible features. If website and checkout amounts differ, pause and contact support. Ask your bank about fees it independently charges. An exchange calculation or discount not offered at checkout cannot be independently treated as the agreed payment amount.",
        "ตรวจสินค้า จำนวน ระยะเวลา และฟังก์ชัน หากยอดบนเว็บกับหน้าจ่ายต่างกัน ให้หยุดและสอบถาม ค่าธรรมเนียมที่ธนาคารคิดเองให้ถามธนาคาร ห้ามถือการแปลงเงินหรือส่วนลดที่ไม่ได้เสนอในหน้าจ่ายเป็นยอดตกลงเอง",
      ],
    ],
    coins: [
      [
        "金幣と銀幣は取得方法、利用条件及び対応機能が異なる場合があります。画面に表示される必要数を確認し、利用後は明細で照合してください。無料付与、購入、消費及び返還は性質が異なります。失敗した会話の返還に疑義がある場合は、同じ会話への重複要求を避け、対象の日時とモデルをお知らせください。",
        "金幣與銀幣的取得方式、使用條件及適用功能可能不同。請先看必要幣數，使用後可查明細。免費贈送、購買、消費及返還的性質不同；如對失敗對話退幣有疑問，請避免重複請求，並提供時間與模型。",
        "Gold and silver units can have different sources, conditions and eligible features. Review the required units before use and compare them with balance history afterwards. Grants, purchases, consumption and reversals are distinct. For a disputed failed-chat reversal, avoid duplicate requests and provide the time and model.",
        "เหรียญทองกับเงินอาจมีแหล่งได้ เงื่อนไข และฟังก์ชันต่างกัน ตรวจจำนวนก่อนใช้และเทียบประวัติหลังใช้ ของฟรี ซื้อ ใช้ และคืนเป็นคนละประเภท หากสงสัยคืนเหรียญแชตล้มเหลว อย่าส่งซ้ำและแจ้งเวลากับโมเดล",
      ],
    ],
    pass: [
      [
        "期限中の利用上限、保存数等は購入したプランの表示に従います。既存プランがある状態で再購入又は変更する場合は、付与と期限の案内を先に確認してください。自動継続課金がないため、利用をやめるだけで将来の自動請求が発生することはありませんが、既に支払った注文の返金は別途申請が必要です。",
        "有效期內的額度、保存數等，依所購方案標示。已有月卡再購買或變更時，請先確認發放及期限規則。本站沒有自動續扣；停止使用不會因此產生未來自動帳單，但已付款訂單的退款仍需另行申請。",
        "Plan limits and storage entitlements follow the purchased offer. Before repurchasing or changing an existing pass, review how benefits and duration are applied. There is no recurring charge to cancel, but stopping use does not itself request a refund of an order already paid.",
        "ขีดจำกัดและจำนวนบันทึกเป็นไปตามแผนซื้อ ก่อนซื้อซ้ำหรือเปลี่ยนบัตรเดิม ตรวจวิธีให้สิทธิและระยะเวลา ไม่มีการหักต่ออายุให้ยกเลิก แต่การหยุดใช้ไม่ได้เป็นคำขอคืนคำสั่งซื้อที่จ่ายแล้ว",
      ],
    ],
    delivery: [
      [
        "支払画面の終了、通信切断又は戻る操作だけでは、支払失敗とも成功とも断定できません。注文状態と決済履歴を確認してください。支払済みか不明な状態で繰り返し購入すると重複する場合があります。決済事業者が拒否した場合、銀行や決済手段側での確認が必要になることがあります。",
        "關閉付款頁、斷線或返回本站，均不能單獨判定付款成功或失敗，請核對訂單及支付記錄。狀態未明時反覆購買，可能造成重複付款。支付商拒絕交易時，也可能需向銀行或付款方式所屬機構確認。",
        "Closing checkout, losing connectivity or returning to the site alone proves neither success nor failure. Check the order and payment records. Repeated purchases while status is unclear can duplicate payment. A declined transaction may require checking with the bank or payment provider.",
        "ปิดหน้าจ่าย เน็ตหลุด หรือกลับเว็บเพียงอย่างเดียวไม่พิสูจน์สำเร็จหรือล้มเหลว ตรวจคำสั่งซื้อกับประวัติ การซื้อซ้ำขณะไม่ชัดอาจจ่ายซ้ำ หากถูกปฏิเสธอาจต้องตรวจธนาคารหรือผู้ให้บริการ",
      ],
    ],
    issues: [
      [
        "異議のある明細は、注文番号又は会話の発生日時から照合します。申告前に、無料付与分と購入分、サイト内の幣数と決済通貨、返還と金銭返金を区別してください。返金に必要な資料と処理の詳細は返金案内、連絡先はお問い合わせページに記載しています。",
        "有疑問的明細可按訂單編號或對話時間查核。提出前請區分免費贈送與購買、站內幣與付款幣別，以及退幣與金錢退款。申請資料及流程見退款說明，聯絡方式見聯絡我們頁面。",
        "Disputed entries can be investigated by order ID or conversation time. Distinguish free grants from purchases, internal units from payment currency, and reversals from monetary refunds. The Refund Policy sets out supporting information and processing; Contact Us lists the contact channel.",
        "ตรวจรายการโต้แย้งด้วยหมายเลขคำสั่งซื้อหรือเวลาสนทนา แยกของฟรีกับซื้อ หน่วยในเว็บกับสกุลเงินจริง และคืนเหรียญกับคืนเงิน หลักฐานและขั้นตอนอยู่ในนโยบายคืนเงิน ช่องทางอยู่หน้าติดต่อ",
      ],
    ],
  },
  content: {
    purpose: [
      [
        "これらのルールは、紹介文、タグ、作者コメント、画像、公開・非公開の設定、会話、面具及び生成要求等に適用されます。非公開にしたこと、架空の設定にしたこと又は他の作品で同様の表現を見たことだけで、禁止内容が許可されるわけではありません。",
        "規則適用於介紹、標籤、作者的話、圖片、公開或非公開設定、對話、面具及生成請求等。設為私密、稱為虛構或其他作品曾出現類似文字，不代表禁止內容就獲准使用。",
        "These rules apply to introductions, tags, creator notes, images, public or private settings, conversations, personas and generation requests. Marking something private or fictional, or finding similar material elsewhere, does not make prohibited content permitted.",
        "กฎใช้กับคำแนะนำ แท็ก หมายเหตุผู้สร้าง รูป การตั้งค่าสาธารณะหรือส่วนตัว สนทนา หน้ากาก และคำขอสร้าง การตั้งส่วนตัว สมมติ หรือเห็นที่อื่นไม่ได้ทำให้เนื้อหาห้ามกลายเป็นอนุญาต",
      ],
    ],
    prohibited: [
      [
        "性的な画像・行為の露骨な表現、未成年者又は年齢不明の人物の性的扱い、性的な強要や搾取を要求してはなりません。また、残虐行為の詳細化、自傷や他害の助長、属性に基づく攻撃、執拗な嫌がらせ、詐欺、個人情報の暴露及び実行可能な違法行為の支援も禁止します。",
        "不得要求露骨的性影像或行為、涉及未成年人或年齡不明人物的性化內容、性脅迫或剝削。亦不得細化殘酷暴力、鼓勵自傷或傷人、基於身分特徵攻擊、持續騷擾、詐騙、公開他人個資或提供可執行的違法協助。",
        "Do not request explicit sexual imagery or acts, sexualization of minors or age-ambiguous people, sexual coercion or exploitation. Detailed brutality, encouragement of self-harm or harm to others, identity-based attacks, persistent harassment, fraud, exposure of private information and actionable assistance with illegal conduct are also prohibited.",
        "ห้ามขอภาพหรือการกระทำทางเพศโจ่งแจ้ง การทำให้ผู้เยาว์หรือผู้ไม่ชัดอายุเป็นเรื่องทางเพศ การบังคับหรือแสวงประโยชน์ทางเพศ รวมถึงความโหดร้ายละเอียด การสนับสนุนทำร้ายตนหรือผู้อื่น โจมตีตามอัตลักษณ์ คุกคามต่อเนื่อง ฉ้อโกง เปิดข้อมูลส่วนตัว และช่วยทำผิดที่ลงมือได้",
      ],
      [
        "安全制限を回避する目的で言い換え、隠語、画像化又は他モデルへの再要求を行うことも禁止します。拒否された要求を、解除の保証があるかのように第三者へ販売・勧誘してはなりません。意図せず問題のある結果が出た場合は、公開や拡散をせずに対象を報告してください。",
        "不得為繞過安全限制而改寫、使用暗語、轉成圖片或換模型重複要求，也不得以保證解除限制為名向他人推銷。如意外產生問題輸出，請先勿公開散布，並提供相關記錄回報。",
        "Do not use rewording, coded language, images or repeated requests to another model to evade safeguards. Do not sell or promote a supposed guarantee of removing restrictions. If a problematic output appears unintentionally, avoid distributing it and report the relevant record.",
        "ห้ามเปลี่ยนคำ ใช้รหัส รูป หรือขอโมเดลอื่นซ้ำเพื่อหลบมาตรการ ห้ามขายหรือชักชวนโดยอ้างรับประกันปลดข้อจำกัด หากได้ผลลัพธ์มีปัญหาโดยไม่ตั้งใจ อย่าแจกจ่ายและแจ้งบันทึกที่เกี่ยวข้อง",
      ],
    ],
    rights: [
      [
        "投稿前に、写真、イラスト、文章、音楽等に利用権限があるかを確認してください。他人の氏名・顔・声や機密情報を、無断でなりすましや嫌がらせに使ってはなりません。権利侵害の申告は、対象 URL、権利の説明及び連絡先を添えて行えます。AI が生成したという理由だけで権利確認が不要にはなりません。",
        "上傳前請確認照片、插畫、文字、音樂等具有使用權。不得未經授權利用他人的姓名、容貌、聲音或機密資料冒用或騷擾。侵權投訴可附網址、權利說明及聯絡方式；AI 生成亦不免除權利核對。",
        "Before uploading photos, illustrations, text or music, check permission to use them. Do not misuse someone’s name, likeness, voice or confidential information for impersonation or harassment. Rights complaints may include URLs, a description of the rights and contact details. AI generation does not eliminate rights checks.",
        "ก่อนอัปโหลดรูป ภาพวาด ข้อความ หรือเพลง ตรวจสิทธิใช้ ห้ามใช้ชื่อ ภาพ เสียง หรือข้อมูลลับผู้อื่นเพื่อแอบอ้างหรือคุกคาม คำร้องสิทธิแนบ URL คำอธิบายสิทธิและที่ติดต่อได้ การสร้างด้วย AI ไม่ยกเว้นตรวจสิทธิ",
      ],
    ],
    report: [
      [
        "報告には、対象の URL 又は会話時刻、問題箇所、理由及び必要な画面情報を含めてください。対応には、内容の確認、表示制限、修正依頼又は利用制限等が含まれる場合があります。誤った対応と考える場合は、元の報告や通知を示して再確認を求められます。自動審査や全件事前確認を常時実施していると保証するものではありません。",
        "回報請附網址或對話時間、問題位置、原因及必要畫面。處理可包括查核、限制展示、要求修正或限制使用。認為處理錯誤時，可附原回報或通知申請複查。本站未保證持續實施自動審核或每件內容都經事前檢查。",
        "A report should identify a URL or conversation time, the problematic part, reasons and necessary screen information. Responses may include review, restricted display, a correction request or access restrictions. Use the original report or notice to request reconsideration. We do not promise continuous automated screening or advance review of every item.",
        "รายงานควรมี URL หรือเวลาสนทนา ส่วนปัญหา เหตุผล และภาพจำเป็น การตอบสนองอาจตรวจ จำกัดแสดง ขอแก้ หรือจำกัดใช้ ขอพิจารณาใหม่โดยแนบรายงานหรือหนังสือเดิมได้ เราไม่สัญญาตรวจอัตโนมัติตลอดเวลาหรือตรวจทุกชิ้นล่วงหน้า",
      ],
    ],
  },
};

export function sfwDetailedClauses(
  kind: SfwDocumentKind,
  section: string,
  locale: Locale,
): string[] {
  return (clauses[kind]?.[section] ?? []).map((text) => text[index[locale]]);
}
