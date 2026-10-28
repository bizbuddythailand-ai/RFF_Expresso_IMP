/* Sample brand for the demo. "Mira Skin" is fictional; every number here is illustrative. */
(function (root) {
  var SAMPLE = {
    brand: { name: 'Mira Skin', note: 'แบรนด์ตัวอย่าง (สมมติ) · beauty บน Shopee, TikTok Shop, Lazada', category: 'Beauty & personal care' },
    products: [
      { sku: 'MS-SUN50', name: 'กันแดดเนื้อน้ำ SPF50 50ml', category: 'กันแดด', price: 390, cost: 95, stock: 1500, baseDaily: 58, leadTime: 21, moq: 500, ageDays: 420, rating: 4.6, oem: 'สยามคอสเมติก OEM',
        roas: { Shopee: 6.2, TikTok: 8.1, Lazada: 3.9 }, ads: { Shopee: 900, TikTok: 1100, Lazada: 400 },
        negRate: 0.08, negThemes: ['sticky', 'shipping'], posThemes: ['good_texture', 'good_result'] },
      { sku: 'MS-VITC', name: 'เซรั่มวิตามินซี 30ml', category: 'เซรั่ม', price: 590, cost: 140, stock: 820, baseDaily: 34, leadTime: 20, moq: 300, ageDays: 310, rating: 4.5, oem: 'บางนา แล็บ',
        roas: { Shopee: 5.4, TikTok: 6.0, Lazada: 4.8 }, ads: { Shopee: 700, TikTok: 800, Lazada: 350 },
        negRate: 0.09, negThemes: ['price', 'small'], posThemes: ['good_result', 'good_texture'] },
      { sku: 'MS-CLEAN', name: 'เจลล้างหน้าอ่อนโยน 150ml', category: 'ล้างหน้า', price: 290, cost: 60, stock: 2300, baseDaily: 41, leadTime: 21, moq: 500, ageDays: 520, rating: 4.7, oem: 'สยามคอสเมติก OEM',
        roas: { Shopee: 7.0, TikTok: 5.2, Lazada: 4.4 }, ads: { Shopee: 500, TikTok: 400, Lazada: 200 },
        negRate: 0.05, negThemes: ['shipping', 'dry'], posThemes: ['good_value', 'good_result'] },
      { sku: 'MS-MASK', name: 'มาสก์โคลนเขียว 100g', category: 'มาสก์', price: 350, cost: 80, stock: 1900, baseDaily: 9, leadTime: 30, moq: 300, ageDays: 230, rating: 4.2, oem: 'บางนา แล็บ',
        roas: { Shopee: 2.8, TikTok: 3.4, Lazada: 2.1 }, ads: { Shopee: 250, TikTok: 250, Lazada: 100 },
        negRate: 0.16, negThemes: ['dry', 'scent'], posThemes: ['good_result'] },
      { sku: 'MS-LIP', name: 'ลิปทินต์ฉ่ำ 3 สี', category: 'เมคอัป', price: 199, cost: 45, stock: 3300, baseDaily: 14, leadTime: 25, moq: 1000, ageDays: 160, rating: 4.4, oem: 'ลาดกระบัง คัลเลอร์',
        roas: { Shopee: 4.1, TikTok: 5.9, Lazada: 2.6 }, ads: { Shopee: 200, TikTok: 350, Lazada: 80 },
        negRate: 0.10, negThemes: ['sticky', 'small'], posThemes: ['good_value', 'good_scent'] },
      { sku: 'MS-TONER', name: 'โทนเนอร์ผิวกระจ่างใส 200ml', category: 'โทนเนอร์', price: 450, cost: 110, stock: 640, baseDaily: 22, leadTime: 25, moq: 300, ageDays: 270, rating: 4.1, oem: 'บางนา แล็บ',
        roas: { Shopee: 4.6, TikTok: 4.9, Lazada: 3.5 }, ads: { Shopee: 450, TikTok: 450, Lazada: 200 },
        negRate: 0.24, negThemes: ['irritation', 'irritation', 'scent'], posThemes: ['good_result', 'good_texture'] },
      { sku: 'MS-BODY', name: 'โลชั่นกันแดดผิวกาย 250ml', category: 'กันแดด', price: 420, cost: 100, stock: 330, baseDaily: 19, leadTime: 21, moq: 500, ageDays: 190, rating: 4.5, oem: 'สยามคอสเมติก OEM',
        roas: { Shopee: 5.1, TikTok: 6.6, Lazada: 3.0 }, ads: { Shopee: 450, TikTok: 600, Lazada: 150 },
        negRate: 0.08, negThemes: ['sticky', 'packaging'], posThemes: ['good_texture', 'good_scent'] },
      { sku: 'MS-SET', name: 'เซ็ตเดินทาง 4 ชิ้น', category: 'เซ็ต', price: 490, cost: 150, stock: 420, baseDaily: 4, leadTime: 30, moq: 300, ageDays: 390, rating: 4.3, oem: 'บางนา แล็บ',
        roas: { Shopee: 2.2, TikTok: 2.6, Lazada: 1.8 }, ads: { Shopee: 150, TikTok: 150, Lazada: 80 },
        negRate: 0.12, negThemes: ['small', 'price'], posThemes: ['good_value'] }
    ],
    concepts: [
      { id: 'C-01', kind: 'new', title: 'กันแดดคุมมันสำหรับผู้ชาย', source: 'เทรนด์ "กันแดดผู้ชาย ผิวมัน" +68% ใน 90 วัน', stage: 'ask', evidence: 74, appeal: 0.78, createdDay: -6, stageDay: -1, interviews: 10, price: 350, cost: 85, history: [] },
      { id: 'C-02', kind: 'new', title: 'เซรั่มลดรอยสิว ไนอาซินาไมด์ 10%', source: 'คำค้นในร้าน "รอยสิว" เพิ่มขึ้นต่อเนื่อง 6 สัปดาห์', stage: 'test', evidence: 68, appeal: 0.58, createdDay: -30, stageDay: -6, budget: 9000, testDay: 6, visits: 1210, preorders: 30, spent: 3860, rate: 2.48, oem: 'บางนา แล็บ', moq: 300, leadTime: 30, interviewScore: 64, syntheticRank: 70, price: 490, cost: 115, history: [] },
      { id: 'C-03', kind: 'new', title: 'กันแดดไซส์พกพา 15ml', source: 'รีวิว "ขนาดพกพา" และคำค้น "กันแดดพกพา"', stage: 'test', evidence: 61, appeal: 0.16, createdDay: -28, stageDay: -6, budget: 7000, testDay: 6, visits: 980, preorders: 6, spent: 3000, rate: 0.61, oem: 'สยามคอสเมติก OEM', moq: 500, leadTime: 21, interviewScore: 61, syntheticRank: 77, price: 159, cost: 40, history: [] },
      { id: 'C-04', kind: 'new', title: 'มาสก์ชีทกลิ่นอ่อน สำหรับผิวแพ้ง่าย', source: 'social listening: "มาสก์ กลิ่นแรง"', stage: 'sense', evidence: 52, appeal: 0.46, createdDay: -3, stageDay: -3, price: 59, cost: 14, history: [] }
    ],
    trends: [
      { query: 'แป้งกันแดด รีทัชระหว่างวัน', title: 'แป้งพัฟกันแดด SPF50 รีทัชได้', growth: 54, score: 63, appeal: 0.66, price: 450, cost: 105 },
      { query: 'สเปรย์กันแดด ฉีดทับเมคอัป', title: 'สเปรย์กันแดดฉีดทับเมคอัป', growth: 41, score: 57, appeal: 0.52, price: 390, cost: 100 },
      { query: 'สกินแคร์ สำหรับผิวแพ้ง่าย', title: 'ครีมบำรุงผิวแพ้ง่าย สูตรไม่มีน้ำหอม', growth: 37, score: 55, appeal: 0.6, price: 520, cost: 120 },
      { query: 'ลิปบาล์ม มีสี กันแดด', title: 'ลิปบาล์มมีสี SPF15', growth: 29, score: 48, appeal: 0.35, price: 190, cost: 42 },
      { query: 'เซ็ตของขวัญ สกินแคร์', title: 'กล่องของขวัญปีใหม่ 3 ชิ้น', growth: 88, score: 66, appeal: 0.57, price: 790, cost: 260 }
    ],
    oems: [
      { name: 'Wise Plus Grow (ล็อตเล็ก)', moq: 50, leadTime: 35, can: ['new'] },
      { name: 'บางนา แล็บ', moq: 300, leadTime: 30, can: ['new', 'reform'] },
      { name: 'สยามคอสเมติก OEM', moq: 500, leadTime: 21, can: ['reform', 'new'] }
    ],
    reviews: [
      { sku: 'MS-TONER', rating: 2, text: 'ใช้แล้วแสบหน้ามาก ผิวแพ้ง่ายไม่ควรใช้' },
      { sku: 'MS-TONER', rating: 3, text: 'กลิ่นแรงไปหน่อย แต่ผิวใสขึ้น' },
      { sku: 'MS-SUN50', rating: 5, text: 'เนื้อบางเบา ซึมไวมาก ไม่เหนียว' },
      { sku: 'MS-MASK', rating: 3, text: 'ล้างออกแล้วหน้าแห้งตึง' }
    ]
  };
  /* Category playbooks: what is reused from brand to brand. Benchmarks here are illustrative. */
  SAMPLE.playbooks = [
    {
      type: 'buddy-playbook', id: 'beauty', name: 'Beauty & personal care', category: 'Beauty & personal care', version: '1.0',
      policy: {},
      oems: SAMPLE.oems,
      trends: SAMPLE.trends,
      benchmark: { tests: 14, passed: 5, rates: [0.4, 0.6, 0.7, 0.9, 1.1, 1.4, 1.6, 1.9, 2.2, 2.6, 2.8, 3.1, 3.4, 4.0], brands: 2, sample: true }
    },
    {
      type: 'buddy-playbook', id: 'supplement', name: 'อาหารเสริม', category: 'อาหารเสริม & wellness', version: '1.0',
      policy: { marginFloor: 0.35, safetyDays: 21, testBudgetCap: 20000, test: { days: 21, scale: 2.0, kill: 0.6 }, clearance: { bundle: 75, flash: 110, outlet: 150 } },
      oems: [
        { name: 'โรงงานอาหารเสริม (มีเลข อย. พร้อมสูตร)', moq: 500, leadTime: 45, can: ['new', 'reform'] },
        { name: 'Co-packer แคปซูล/ผงชง ล็อตเล็ก', moq: 300, leadTime: 40, can: ['new'] }
      ],
      trends: [
        { query: 'คอลลาเจน ผงชง ไม่หวาน', title: 'คอลลาเจนผงชง สูตรไม่มีน้ำตาล', growth: 46, score: 61, appeal: 0.6, price: 590, cost: 160 },
        { query: 'แมกนีเซียม นอนหลับ', title: 'แมกนีเซียม + ธีอะนีน ช่วยผ่อนคลายก่อนนอน', growth: 72, score: 66, appeal: 0.64, price: 690, cost: 170 },
        { query: 'ไฟเบอร์ ดีท็อกซ์ ผู้สูงอายุ', title: 'ไฟเบอร์ชงสำหรับวัย 50+', growth: 33, score: 52, appeal: 0.5, price: 450, cost: 120 },
        { query: 'วิตามิน รวม แบบเยลลี่', title: 'วิตามินรวมแบบเยลลี่สำหรับคนทำงาน', growth: 39, score: 55, appeal: 0.42, price: 390, cost: 110 }
      ],
      benchmark: { tests: 9, passed: 3, rates: [0.3, 0.5, 0.8, 1.0, 1.3, 1.7, 2.1, 2.4, 3.0], brands: 1, sample: true }
    }
  ];
  SAMPLE.playbook = SAMPLE.playbooks[0];
  if (typeof module !== 'undefined' && module.exports) module.exports = SAMPLE;
  else root.BUDDY_SAMPLE = SAMPLE;
})(typeof window !== 'undefined' ? window : this);
