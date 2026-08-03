// 山水S酒店 · 婚宴菜单数据
// 架构说明（v2 · 菜品库模式）：
//  - 所有菜品集中在「菜品库 LIBRARY_SEED」中，图片/展示位置只存一份；
//  - 每个套餐的 dishes 只保存菜品库的 id 引用（字符串数组），
//    因此同一道菜出现在多个菜单时共用同一图片，编辑一次处处生效；
//  - 分类仅保留三类：凉菜 / 主菜 / 主食点心（金巢美果喜添丁 归入主菜）；
//  - 佳偶天成宴(B) 的 16 道菜由 PDF《山水S酒店-2026年婚宴菜单3》真实提取（第5页）；
//  - A / C / D 三档套餐暂用 B 的菜品做示例，标记为 demo，正式菜品待补充；
//  - desc 字段为示例文案，待替换为正式介绍；
//  - 其他宴席类型（宝宝宴/订婚宴/尾牙宴/乔迁宴）暂无数据，接入时按此结构补充即可。

const BANQUETS = [
  { id: 'wedding',      name: '婚宴' },
  { id: 'baby',         name: '宝宝宴' },
  { id: 'engagement',   name: '订婚宴' },
  { id: 'yearEnd',      name: '尾牙宴' },
  { id: 'housewarming', name: '乔迁宴' },
];

// 分类顺序（左侧导航 / 管理下拉按此排列）—— 仅三类
const CATEGORIES = ['凉菜', '主菜', '主食点心'];

// ============ 菜品库（主数据：所有菜单引用这里） ============
const LIBRARY_SEED = [
  { id: 'lib01', num: '01', cn: '迎宾四彩碟',     en: 'Welcome Four Delicacies Platter',              cat: '凉菜',     icon: 'platter', desc: '四种精致冷菜拼盘，色香味俱全，是宴席开场之选。', image: null, crop: null },
  { id: 'lib02', num: '02', cn: '鸿运乳猪拼盘',   en: 'Half Lucky Roast Goose',                      cat: '主菜',     icon: 'bird',    desc: '皮脆肉嫩，红润喜庆，寓意鸿运当头、好彩头。', image: null, crop: null },
  { id: 'lib03', num: '03', cn: '玫瑰豉油三黄鸡', en: 'Rose Soy Sauce Three-Yellow Chicken',         cat: '主菜',     icon: 'bird',    desc: '精选三黄鸡，配玫瑰豉油蘸食，皮爽肉嫩。', image: null, crop: null },
  { id: 'lib04', num: '04', cn: '金沙避风塘双青龙', en: 'Golden Sand Typhoon Shelter Double Lobsters', cat: '主菜',     icon: 'lobster', desc: '避风塘风味焗制青龙虾，蒜香酥脆、虾肉鲜甜。', image: null, crop: null },
  { id: 'lib05', num: '05', cn: '清蒸龙趸鱼',     en: 'Steamed Giant Grouper',                       cat: '主菜',     icon: 'fish',    desc: '深海龙趸清蒸，肉质细嫩，原汁原味。', image: null, crop: null },
  { id: 'lib06', num: '06', cn: '蒜蓉蒸八头鲜鲍', en: 'Steamed 8-Head Fresh Abalone with Minced Garlic', cat: '主菜', icon: 'shell', desc: '八头鲜鲍铺蒜蓉蒸制，鲜香弹牙、鲍味浓郁。', image: null, crop: null },
  { id: 'lib07', num: '07', cn: '石斛炖老鸡汤',   en: 'Stewed Old Chicken Soup with Dendrobium',      cat: '主菜',     icon: 'bowl',    desc: '石斛慢炖老鸡，汤清味醇，滋阴润燥。', image: null, crop: null },
  { id: 'lib08', num: '08', cn: '金蒜银丝蒸元贝', en: 'Steamed Scallops with Minced Garlic & Vermicelli', cat: '主菜', icon: 'shell', desc: '元贝一开二配银丝，金蒜提鲜，鲜味层次丰富。', image: null, crop: null },
  { id: 'lib09', num: '09', cn: '鲍汁花菇扣鹅掌', en: 'Braised Goose Webs with Mushrooms in Abalone Sauce', cat: '主菜', icon: 'bird', desc: '鲍汁浓香，花菇软糯，鹅掌入味绵滑。', image: null, crop: null },
  { id: 'lib10', num: '10', cn: '金玉良缘卷',     en: 'Crispy Milk & Taro Roll Platter',              cat: '主菜',     icon: 'mound',   desc: '酥脆奶香与芋香交融，寓意金玉良缘。', image: null, crop: null },
  { id: 'lib11', num: '11', cn: '金巢美果喜添丁', en: 'Golden Nest Fruity Fortune Platter',           cat: '主菜',     icon: 'fruit',   desc: '精美果盘点缀，喜庆添丁之喜，清甜爽口。', image: null, crop: null },
  { id: 'lib12', num: '12', cn: '盐水浸时蔬',     en: 'Poached Seasonal Vegetables in Brine',          cat: '主菜',     icon: 'leaf',    desc: '时令蔬菜盐水浸煮，清爽解腻、平衡口感。', image: null, crop: null },
  { id: 'lib13', num: '13', cn: '海鲜炒饭',       en: 'Seafood Fried Rice',                            cat: '主食点心', icon: 'mound',   desc: '粒粒分明，海鲜提鲜，宴席经典主食。', image: null, crop: null },
  { id: 'lib14', num: '14', cn: '心心相印美点',   en: 'Heart-to-Heart Pastries',                       cat: '主食点心', icon: 'heart',   desc: '双心造型精致点心，甜而不腻、寓意成双。', image: null, crop: null },
  { id: 'lib15', num: '15', cn: '莲子红豆沙糖水', en: 'Lotus Seed & Red Bean Sweet Soup',              cat: '主食点心', icon: 'bowl',    desc: '莲子红豆慢熬，温润清甜，圆满收尾。', image: null, crop: null },
  { id: 'lib16', num: '16', cn: '风情水果拼盘',   en: 'Exotic Fruit Platter',                          cat: '主菜',     icon: 'fruit',   desc: '当季鲜果拼盘，色彩缤纷，清新解腻。', image: null, crop: null },
];

// 婚宴套餐：dishes 为菜品库 id 引用数组（多套餐可共用同一菜品）
const WEDDING_DISHES = LIBRARY_SEED.map((d) => d.id);

const MENU_DATA = {
  wedding: {
    name: '婚宴',
    packages: [
      { id: 'A', name: '天作之合宴', price: 3999, demo: true,  dishes: WEDDING_DISHES.slice() },
      { id: 'B', name: '佳偶天成宴', price: 2899, demo: false, dishes: WEDDING_DISHES.slice() },
      { id: 'C', name: '龙凤呈祥宴', price: 2299, demo: true,  dishes: WEDDING_DISHES.slice() },
      { id: 'D', name: '花好月圆宴', price: 1888, demo: true,  dishes: WEDDING_DISHES.slice() },
    ],
  },
  // 其他宴席类型暂未配置，接入时按 MENU_DATA.wedding 结构补充即可
  baby: null,
  engagement: null,
  yearEnd: null,
  housewarming: null,
};
