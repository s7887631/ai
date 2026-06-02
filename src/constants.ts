import { DocNode, Connection, DocType } from './types';

export const COLOR_PALETTE = [
  '#7c6dfa', // Royal purple
  '#9b6dfa', // Indigo sparkle
  '#fa6d9a', // Cosmic rose
  '#fab06d', // Sunset coral
  '#6dfabc', // Emerald vibe
  '#6d8dfa', // Clean sky
];

export const TONE_MAP: Record<string, string> = {
  '正式精準': '字句務實，結構嚴整，專業可信',
  '親切有溫度': '充滿同理心，避免生硬官樣文章，多用溫和肯定字句',
  '簡潔俐落': '句子短小精悍，重點直接條列，清晰易讀',
  '謙遜委婉': '態度真摯恭敬，言辭修潤婉轉，顧全大局留有妥適彈性'
};

export const PRESETS: Record<string, {
  docType: DocType;
  context: string;
  nodes: Omit<DocNode, 'id'>[];
  connections: { fromIdx: number; toIdx: number }[];
}> = {
  email: {
    docType: '商務 Email',
    context: '各位主管：新產品研發專案第一階段截止日為下週五(5/22)，目前A與C兩組功能架構未更新進度，請於本週五前上線填寫進度表。',
    nodes: [
      { text: '主旨: [截止通知] 專案階段截止提醒', color: '#7c6dfa', x: 40, y: 30, w: 140, h: 54 },
      { text: '開頭: 親愛的主管與負責人', color: '#7c6dfa', x: 40, y: 110, w: 140, h: 54 },
      { text: '核心: 5/22 第一階段截止提醒', color: '#9b6dfa', x: 220, y: 30, w: 140, h: 54 },
      { text: '行動: 週五前於系統填寫 A/C 進度', color: '#fab06d', x: 220, y: 110, w: 140, h: 54 },
      { text: '署名: 專案管理處 PM 敬啟', color: '#6d8dfa', x: 220, y: 190, w: 140, h: 54 },
    ],
    connections: [
      { fromIdx: 0, toIdx: 1 },
      { fromIdx: 1, toIdx: 2 },
      { fromIdx: 2, toIdx: 3 },
      { fromIdx: 3, toIdx: 4 },
    ]
  },
  announcement: {
    docType: '內部公告',
    context: '公司搬遷與伺服器機房升級，本週六(5/16)早上9:00至下午18:00內部網路與VPN將暫停服務，當日無法進行遠端加班報審。',
    nodes: [
      { text: '主旨: 本週六內部網路暫停服務公告', color: '#fa6d9a', x: 40, y: 40, w: 140, h: 54 },
      { text: '背景說明: 週六機房搬遷與升級', color: '#9b6dfa', x: 40, y: 140, w: 140, h: 54 },
      { text: '受影響範圍: VPN、內部網、加班系統', color: '#fa6d9a', x: 220, y: 30, w: 140, h: 54 },
      { text: '替代方案: 請提前週五前送審加班', color: '#fab06d', x: 220, y: 110, w: 140, h: 54 },
      { text: '落款: 資訊技術部 敬上', color: '#6d8dfa', x: 220, y: 195, w: 140, h: 54 },
    ],
    connections: [
      { fromIdx: 0, toIdx: 1 },
      { fromIdx: 1, toIdx: 2 },
      { fromIdx: 2, toIdx: 3 },
      { fromIdx: 3, toIdx: 4 },
    ]
  },
  sop: {
    docType: '操作 SOP',
    context: '為防範勒索軟體，建立新進人員辦公電腦資安防禦SOP：1.啟動Windows Defender全機掃描、2.更改初始高複雜度密碼、3.設定定期備份雲端硬碟。',
    nodes: [
      { text: '資安防禦步驟 SOP', color: '#6dfabc', x: 40, y: 30, w: 140, h: 54 },
      { text: '步驟 1: 啟動防毒全機掃描', color: '#6dfabc', x: 40, y: 140, w: 140, h: 54 },
      { text: '步驟 2: 修改初始密碼(12字以上)', color: '#9b6dfa', x: 220, y: 45, w: 140, h: 54 },
      { text: '步驟 3: 設定雲端備份排程', color: '#fab06d', x: 220, y: 150, w: 140, h: 54 },
    ],
    connections: [
      { fromIdx: 0, toIdx: 1 },
      { fromIdx: 1, toIdx: 2 },
      { fromIdx: 2, toIdx: 3 },
    ]
  }
};
