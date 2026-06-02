export interface DocNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
}

export interface Connection {
  from: string;
  to: string;
}

export interface CloudNote {
  id: string;
  timestamp: string;
  title: string;
  preview: string;
  link: string;
  prompt: string;
  docType: string;
  tone: string;
  isMeeting?: boolean;
}

export interface SavedRecording {
  id: string;
  title: string;
  timestamp: string;
  duration: number;
  transcript: string;
  url?: string;
  link?: string;
}

export type ToneType = '正式精準' | '親切有溫度' | '簡潔俐落' | '謙遜委婉';

export type DocType = '商務 Email' | '內部公告' | '會議議程' | '工作週報' | '操作 SOP' | '提案簡述' | '婉拒信函';
