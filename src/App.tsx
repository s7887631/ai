import React, { useState, useEffect } from 'react';
import { DocCanvas } from './components/DocCanvas';
import { MeetingRecorder } from './components/MeetingRecorder';
import { ShareModal } from './components/ShareModal';
import { EditNodeModal } from './components/EditNodeModal';
import { DocNode, Connection, CloudNote, ToneType, DocType } from './types';
import { COLOR_PALETTE, TONE_MAP, PRESETS } from './constants';
import { 
  FileText, Plus, HelpCircle, Share2, Trash2, ChevronRight, 
  Sparkles, Layers, RefreshCw, Layers2, Copy, ExternalLink, Library, Mic
} from 'lucide-react';

export default function App() {
  const [docType, setDocType] = useState<DocType>('商務 Email');
  const [docContext, setDocContext] = useState('');
  const [activeTone, setActiveTone] = useState<ToneType>('正式精準');
  
  const [nodes, setNodes] = useState<DocNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [arrowMode, setArrowMode] = useState(false);
  
  // Modals
  const [editingNode, setEditingNode] = useState<DocNode | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRecModalOpen, setIsRecModalOpen] = useState(false);

  // Compile States
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledPrompt, setCompiledPrompt] = useState('');
  const [draftResult, setDraftResult] = useState('');

  // Persisting cloud prompts & recordings
  const [cloudNotes, setCloudNotes] = useState<CloudNote[]>(() => {
    const saved = localStorage.getItem('canvas_cloud_notes');
    return saved ? JSON.parse(saved) : [];
  });

  const [toasts, setToasts] = useState<{ id: number; msg: string; icon?: string }[]>([]);

  // Auto trigger save notes to local storage
  useEffect(() => {
    localStorage.setItem('canvas_cloud_notes', JSON.stringify(cloudNotes));
  }, [cloudNotes]);

  // Loading Preset
  const handleLoadPreset = (key: 'email' | 'announcement' | 'sop') => {
    const preset = PRESETS[key];
    if (!preset) return;
    
    setDocType(preset.docType);
    setDocContext(preset.context);
    
    // Create new nodes on canvas
    const calculatedNodes: DocNode[] = preset.nodes.map((n, idx) => ({
      ...n,
      id: `n_${Date.now()}_preset_${idx}`,
    }));
    
    // Create connections mapping matching original indices
    const calculatedConnections: Connection[] = preset.connections.map((c) => ({
      from: calculatedNodes[c.fromIdx].id,
      to: calculatedNodes[c.toIdx].id,
    }));

    setNodes(calculatedNodes);
    setConnections(calculatedConnections);
    setSelectedNodeId(null);
    setArrowMode(false);
    triggerToast(`已成功載入「${preset.docType}」精選範本`, '🌟');
  };

  // Toast handler
  const triggerToast = (msg: string, icon = '✨') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Node operations
  const handleAddNewNode = (text: string, forceColor?: string) => {
    const defaultColor = forceColor || COLOR_PALETTE[nodes.length % COLOR_PALETTE.length];
    const canvasWrap = document.getElementById('canvas-container-wrap');
    const width = canvasWrap?.clientWidth || 500;
    const height = canvasWrap?.clientHeight || 350;

    const newNode: DocNode = {
      id: `n_${Date.now()}`,
      x: width / 2 - 70 + (Math.random() - 0.5) * 30,
      y: height / 2 - 27 + (Math.random() - 0.5) * 30,
      w: 144,
      h: 54,
      text,
      color: defaultColor,
    };

    setNodes((prev) => [...prev, newNode]);
    triggerToast(`已在畫布新增『${text}』流程區塊`, '🎨');
  };

  const handleUpdateNode = (nodeId: string, updatedText: string, updatedColor: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, text: updatedText, color: updatedColor } : n))
    );
    triggerToast('模組區塊樣式編輯儲存完成', '📝');
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) => prev.filter((c) => c.from !== nodeId && c.to !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    triggerToast('已刪除指定畫布流程區塊', '🗑️');
  };

  // Connection operations
  const handleAddConnection = (fromId: string, toId: string) => {
    const alreadyConnected = connections.some((c) => c.from === fromId && c.to === toId);
    if (alreadyConnected) {
      triggerToast('兩模組間已建立有向流程箭頭。', 'ℹ️');
      return;
    }
    setConnections((prev) => [...prev, { from: fromId, to: toId }]);
    const fromName = nodes.find(n => n.id === fromId)?.text || '';
    const toName = nodes.find(n => n.id === toId)?.text || '';
    triggerToast(`連結成功：『${fromName.slice(0, 5)}』 ➔ 『${toName.slice(0, 5)}』`, '🔌');
  };

  const clearCanvas = () => {
    setNodes([]);
    setConnections([]);
    setSelectedNodeId(null);
    setArrowMode(false);
    setCompiledPrompt('');
    setDraftResult('');
    triggerToast('畫布元件已全部重置。', '🧹');
  };

  // Compile & Document Generation Flow
  const handleCompileAndDraft = async () => {
    if (!docContext.trim()) {
      triggerToast('請先填寫關鍵背景資訊！', '⚠️');
      return;
    }
    if (nodes.length === 0) {
      triggerToast('請先新增排版節點再行編譯！', '⚠️');
      return;
    }

    setIsCompiling(true);
    triggerToast('AI 正在分析畫布流程與編譯 Prompt...', '⚡');

    // Sort nodes vertically as main chronological draft order
    const sortedNodes = [...nodes].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 30) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const blocksStr = sortedNodes.map((n, idx) => `  - 步驟${idx + 1}: ${n.text}`).join('\n');

    const flowStr = connections.length > 0
      ? connections.map((c, idx) => {
          const fromNode = nodes.find(n => n.id === c.from);
          const toNode = nodes.find(n => n.id === c.to);
          return fromNode && toNode ? `  - ${idx + 1}. [${fromNode.text}] ➔ [${toNode.text}]` : '';
        }).filter(Boolean).join('\n')
      : '  - （依畫布排版由上至下依序呈現）';

    const toneDescription = TONE_MAP[activeTone];

    const finalPrompt = `【角色】
你是精通職場高效溝通與格式排版的「行政文書專家與特助」。

【任務】
根據下方【背景資訊】與【畫布文書結構】，產出一份高質感的「${docType}」公務文書。
所有容易變動的資訊（日期、姓名、單位、數字）一律使用 [方括號佔位符] 標記，以便快速替補。

【背景資訊】
${docContext}

【畫布文書結構列表（必須嚴格遵守以下流程組織內容）】
${blocksStr}

【流程先後順序與連結關係】
${flowStr}

【限制與規格】
1. 語氣文風：「${activeTone}」—— ${toneDescription}
2. 請輸出通用性高、文字優雅流暢、可以直接複製的信函公告正本
3. 全文直接輸出公務文書主體，不要加上任何「好的，這是為您生成的...」等 AI 多餘前言或系統宣告

【格式主體】
直接書寫「${docType}」本體，段落與行距得當。`;

    setCompiledPrompt(finalPrompt);

    try {
      // Call standard server-side drafting API proxy
      const response = await fetch('/api/gemini/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: finalPrompt,
          docType,
          tone: activeTone,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDraftResult(data.draftText);
        triggerToast('AI 開發模板與信件草稿編寫完成！', '🤖');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`AI 草稿編寫失敗: ${err.message || err}`, '⚠️');
    } finally {
      setIsCompiling(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => triggerToast(`${type}已複製到剪貼簿`, '📋'))
      .catch((err) => console.error(err));
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col noise-overlay relative z-10 selection:bg-brand-accent/30 text-text-bright">
      {/* HEADER BAR */}
      <header className="bg-surface border-b border-border-custom px-5 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-brand-accent to-brand-coral rounded-xl p-2.5 shadow-lg shadow-brand-accent/20">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-black text-sm tracking-tight bg-gradient-to-r from-text-bright via-[#c46dfa] to-brand-coral bg-clip-text text-transparent">
              行政文書 Canvas 智慧工坊 Pro
            </h1>
            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
              Visual Structure ➔ AI Smart Document Generator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online state pulse */}
          <div className="flex items-center gap-1.5 bg-ink/70 px-3 py-1 rounded-full border border-border-custom text-[10px] font-mono">
            <span className="w-1.5 h-1.5 bg-brand-emerald rounded-full animate-pulse shadow-glow" />
            LIVE COMPILE ACTIVE
          </div>

          <button
            onClick={() => setIsHelpOpen(true)}
            className="text-text-muted hover:text-text-bright p-2 rounded-lg border border-border-custom/50 hover:border-brand-accent/50 cursor-pointer transition-all"
            title="查看使用說明"
          >
            <HelpCircle size={15} />
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className="bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 hover:border-brand-emerald px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-brand-emerald/5"
          >
            <Share2 size={13} /> 分享協作
          </button>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* LEFT CONFIGURATION PANEL: 5 columns */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-0 lg:pr-1 max-h-[calc(100vh-100px)]">
          {/* SECTION 1: Document Settings */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4.5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border-custom pb-2">
              <span className="text-xs font-mono font-bold text-brand-accent">01 //</span>
              <h3 className="font-display font-semibold text-xs text-text-muted uppercase tracking-wider">文書基礎設定</h3>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-mono uppercase tracking-wider block">文書類型分類：</label>
              <select
                value={docType}
                onChange={(e) => {
                  setDocType(e.target.value as DocType);
                  triggerToast(`切換公務類型為「${e.target.value}」`, '📝');
                }}
                className="w-full bg-surface border border-border-custom/80 focus:border-brand-accent rounded-xl text-xs font-medium py-2.5 px-3.5 text-text-bright outline-none cursor-pointer"
              >
                <option value="商務 Email">✉️ 商務 Email</option>
                <option value="內部公告">📋 內部公告</option>
                <option value="會議議程">📅 會議議程</option>
                <option value="工作週報">📊 工作週報</option>
                <option value="操作 SOP">📝 操作 SOP</option>
                <option value="提案簡述">💡 提案簡述</option>
                <option value="婉拒信函">🙏 婉拒信函</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-mono uppercase tracking-wider block flex items-center justify-between">
                <span>關鍵事實與背景描述：</span>
                <span className="text-[9px] text-brand-coral font-bold uppercase tracking-widest">*必填</span>
              </label>
              <textarea
                value={docContext}
                onChange={(e) => setDocContext(e.target.value)}
                rows={4}
                placeholder="例如：公司搬遷與機房升級，本週六(5/16)內部架構與VPN即將離線，當天有加班報審需求的人員，請提前於週五下班前送審系統登記..."
                className="w-full bg-surface border border-border-custom/80 focus:border-brand-accent rounded-xl text-xs p-3 leading-relaxed text-text-bright outline-none resize-none placeholder:text-text-muted/40 font-sans"
              />
            </div>

            <div>
              <label className="text-[11px] text-text-muted font-mono uppercase tracking-wider block mb-2">語氣文學風采：</label>
              <div className="grid grid-cols-2 gap-2">
                {(['正式精準', '親切有溫度', '簡潔俐落', '謙遜委婉'] as ToneType[]).map((t) => {
                  const isActive = activeTone === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setActiveTone(t);
                        triggerToast(`語氣已設定為『${t}』`, '🎭');
                      }}
                      className={`text-xs py-2 px-3 rounded-xl border font-sans font-medium cursor-pointer transition-all ${
                        isActive
                          ? 'bg-brand-accent/15 border-brand-accent text-brand-accent shadow-lg shadow-brand-accent/5 font-bold'
                          : 'bg-surface border-border-custom/60 text-text-muted hover:border-border-custom hover:text-text-bright'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: Canvas Elements config */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4.5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border-custom pb-2">
              <span className="text-xs font-mono font-bold text-brand-accent">02 //</span>
              <h3 className="font-display font-semibold text-xs text-text-muted uppercase tracking-wider">畫布流程元件</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleAddNewNode('主旨/標題', '#7c6dfa')}
                className="bg-brand-accent/10 border border-brand-accent/30 hover:border-brand-accent text-brand-accent/90 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 主旨與標題
              </button>
              <button
                onClick={() => handleAddNewNode('說明/核心事實', '#9b6dfa')}
                className="bg-[#9b6dfa]/10 border border-[#9b6dfa]/30 hover:border-[#9b6dfa] text-[#b89dfc] py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 核心解說
              </button>
              <button
                onClick={() => handleAddNewNode('變動/對照點', '#fa6d9a')}
                className="bg-brand-coral/10 border border-brand-coral/30 hover:border-brand-coral text-brand-coral/90 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 變革與對照
              </button>
              <button
                onClick={() => handleAddNewNode('行動指引 (CTA)', '#fab06d')}
                className="bg-[#fab06d]/10 border border-[#fab06d]/30 hover:border-[#fab06d] text-[#fcd09d] py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 行動指引
              </button>
              <button
                onClick={() => handleAddNewNode('備註/例外說明', '#6dfabc')}
                className="bg-brand-emerald/10 border border-brand-emerald/30 hover:border-brand-emerald text-brand-emerald/90 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 備註例外
              </button>
              <button
                onClick={() => handleAddNewNode('署名/聯絡處', '#6d8dfa')}
                className="bg-[#6d8dfa]/10 border border-[#6d8dfa]/30 hover:border-[#6d8dfa] text-[#9dbdfc] py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus size={12} /> ＋ 署名與簽署
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border-custom/50 pt-3 mt-1 text-xs">
              <span className="text-text-muted text-xs flex items-center gap-1">
                <Layers size={13} />
                有向連結模式：
              </span>
              <button
                onClick={() => {
                  setArrowMode(!arrowMode);
                  triggerToast(arrowMode ? '已離開有向箭頭連連看模式' : '連線模式：請依序點擊起點與終點節點', '🔌');
                }}
                className={`py-1.5 px-3.5 rounded-xl border flex items-center gap-2 font-medium cursor-pointer transition-all ${
                  arrowMode
                    ? 'bg-brand-emerald/15 border-brand-emerald text-brand-emerald'
                    : 'bg-ink border-border-custom text-text-muted hover:text-text-bright'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${arrowMode ? 'bg-brand-emerald animate-pulse shadow-glow' : 'bg-text-muted'}`} />
                {arrowMode ? '連線中' : '連線建立'}
              </button>
            </div>
          </div>

          {/* SECTION 3: Presets & Templates */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4.5 flex flex-col gap-3">
            <h4 className="text-[10px] text-text-muted font-mono tracking-wider uppercase">⚡ 免費公務精選範本</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleLoadPreset('email')}
                className="bg-ink hover:bg-surface border border-border-custom text-xs py-1.5 px-3 rounded-lg text-text-bright cursor-pointer"
              >
                📧 截止日提醒信
              </button>
              <button
                onClick={() => handleLoadPreset('announcement')}
                className="bg-ink hover:bg-surface border border-border-custom text-xs py-1.5 px-3 rounded-lg text-text-bright cursor-pointer"
              >
                📢 制度變更公告
              </button>
              <button
                onClick={() => handleLoadPreset('sop')}
                className="bg-ink hover:bg-surface border border-border-custom text-xs py-1.5 px-3 rounded-lg text-text-bright cursor-pointer"
              >
                📝 電腦資安 SOP
              </button>
            </div>
          </div>

          {/* SECTION 4: Meeting Recorder Panel */}
          <MeetingRecorder
            onAddCloudNote={(note) => {
              setCloudNotes((prev) => [
                {
                  id: `n_${Date.now()}`,
                  timestamp: new Date().toLocaleString('zh-TW'),
                  title: note.title,
                  preview: note.prompt.slice(0, 100) + '...',
                  link: note.link,
                  prompt: note.prompt,
                  docType: '會議議程',
                  tone: '正式精準',
                  isMeeting: note.isMeeting,
                },
                ...prev,
              ]);
            }}
            onToast={triggerToast}
          />

          {/* CLOUD NOTES DIRECTORY */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4.5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] text-brand-emerald font-mono uppercase tracking-wider flex items-center gap-1">
                <Library size={13} /> ☁️ Prompt 雲端儲存筆記
              </h4>
              <span className="text-[10px] text-text-muted font-mono">{cloudNotes.length} 筆已存檔</span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[190px] overflow-y-auto pr-1">
              {cloudNotes.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted/60 leading-relaxed bg-ink/30 border border-dashed border-border-custom/50 rounded-xl">
                  尚無任何已儲存的 Prompt / 會議記錄。<br />
                  <span className="text-[10px] text-text-muted/40">編譯完成後，點擊「同步至雲端」分享</span>
                </div>
              ) : (
                cloudNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      setCompiledPrompt(note.prompt);
                      setDraftResult('');
                      triggerToast(`已載入筆記「${note.title.slice(0, 16)}」！`, '📂');
                    }}
                    className="bg-ink hover:bg-surface border border-border-custom hover:border-brand-accent p-3 rounded-xl cursor-not-allowed group transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-text-bright group-hover:text-brand-accent leading-snug">
                        {note.isMeeting ? '🎙️' : '📝'} {note.title}
                      </span>
                      <span className="text-[9px] text-text-muted font-mono whitespace-nowrap">{note.timestamp}</span>
                    </div>
                    <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">
                      {note.preview}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border-custom/30">
                      <span className="text-[9px] text-brand-emerald font-mono tracking-wider break-all truncate block max-w-[150px]">
                        {note.link}
                      </span>
                      <a
                        href={note.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-brand-accent hover:underline flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        檢視原始連結 <ExternalLink size={8} />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cloudNotes.length > 0 && (
              <button
                onClick={() => {
                  setCloudNotes([]);
                  triggerToast('已清空本地快取儲存雲端列。', '🗑️');
                }}
                className="w-full text-center text-text-muted hover:text-brand-coral text-[10px] py-1 border border-border-custom rounded-lg border-dashed hover:border-brand-coral/45 cursor-pointer mt-1"
              >
                🗑️ 清空所有雲端與會議記錄存檔
              </button>
            )}
          </div>
        </div>

        {/* RIGHT VISUAL INTERACTION GRID: 8 columns */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden max-h-[calc(100vh-100px)]">
          {/* SECTION A: Visual canvas panel */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4 flex flex-col flex-1 min-h-[380px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-custom pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-accent" />
                <h4 className="font-display font-semibold text-xs text-text-bright tracking-wide">視覺架構畫布</h4>
                <span className="text-[10px] text-text-muted bg-ink/80 px-2 py-0.5 rounded border border-border-custom">
                  雙擊編輯 · 拖曳排序
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={clearCanvas}
                  className="bg-ink hover:bg-surface border border-border-custom text-[10px] text-brand-coral font-medium py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
                >
                  清空畫布
                </button>
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="bg-gradient-to-r from-brand-accent to-brand-coral text-[10px] text-white py-1.5 px-3.5 rounded-lg cursor-pointer font-bold transition-all hover:opacity-95"
                >
                  📸 輸出畫布
                </button>
              </div>
            </div>

            {/* Canvas Area Container */}
            <div id="canvas-container-wrap" className="flex-1 mt-3 relative overflow-hidden rounded-xl">
              <DocCanvas
                nodes={nodes}
                connections={connections}
                selectedNodeId={selectedNodeId}
                arrowMode={arrowMode}
                onUpdateNodes={setNodes}
                onUpdateConnections={setConnections}
                onSelectNode={setSelectedNodeId}
                onDoubleClickNode={setEditingNode}
                onAddConnection={handleAddConnection}
              />
            </div>
            <div className="text-[10px] text-text-muted font-mono bg-ink/35 border border-border-custom/50 py-1.5 px-3.5 rounded-lg flex items-center justify-between mt-2">
              <span>HINT: 拖曳排列流程模組 · 雙擊區塊編輯內容色調 · 多人連線指示公文脈絡</span>
              <span className="text-brand-accent">PRAC WORKSPACE</span>
            </div>
          </div>

          {/* SECTION B: AI Prompts Compiler output & Drafting */}
          <div className="bg-panel border border-border-custom rounded-2xl p-4.5 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs">⚡</span>
                <h4 className="font-display font-bold text-sm bg-gradient-to-r from-[#9b6dfa] to-brand-coral bg-clip-text text-transparent">
                  AI 專家提示詞與草稿生成器
                </h4>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCompileAndDraft}
                  disabled={isCompiling}
                  className="bg-brand-accent hover:bg-brand-accent/95 text-xs text-white py-1.5 px-4 rounded-xl cursor-pointer font-semibold flex items-center gap-1.5 shadow-md shadow-brand-accent/15"
                >
                  {isCompiling ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isCompiling ? '編譯處理中...' : '編譯生成 Prompt 與草稿'}
                </button>
              </div>
            </div>

            {/* Generated results columns split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left side: Compiled Prompt output */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest block">① 系統組裝 AI Prompt 模板：</span>
                  {compiledPrompt && (
                    <button
                      onClick={() => copyToClipboard(compiledPrompt, '組裝提示詞')}
                      className="text-[10px] text-brand-accent hover:underline flex items-center gap-1 font-semibold cursor-pointer border border-brand-accent/25 px-2 py-0.5 rounded bg-brand-accent/5"
                    >
                      <Copy size={9} /> 複製 Prompt 
                    </button>
                  )}
                </div>
                <textarea
                  readOnly
                  value={compiledPrompt}
                  placeholder="請在左側填寫事實描述背景、添加排列畫布結構，然後點擊「編譯生成 Prompt 與草稿」調用 Gemini 行政大腦..."
                  className="w-full bg-ink border border-border-custom focus:border-brand-accent text-[#c8c8e4] text-xs font-mono p-3 leading-relaxed rounded-xl outline-none resize-none h-44 h-[210px]"
                />
              </div>

              {/* Right side: AI generated completed administrative document draft */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest block">② Gemini 手動草案/信件成果：</span>
                  {draftResult && (
                    <button
                      onClick={() => copyToClipboard(draftResult, 'AI 草稿全文')}
                      className="text-[10px] text-brand-coral hover:underline flex items-center gap-1 font-semibold cursor-pointer border border-brand-coral/25 px-2 py-0.5 rounded bg-brand-coral/5"
                    >
                      <Copy size={9} /> 複製草稿全文
                    </button>
                  )}
                </div>
                <textarea
                  readOnly
                  value={isCompiling ? 'Gemini 3.5 行政文書 AI 召喚中，正為您編著專業模板正文...' : draftResult}
                  placeholder="當您點擊編譯後，此處將自動呈現由 Gemini 3.5-Flash 行政大腦所撰寫出的高通用、已加上 [方括號佔位符] 的公務公文、商務信函草案，供您直接微調、複製帶走！"
                  className="w-full bg-ink border border-border-custom focus:border-brand-accent text-brand-emerald text-xs p-3 leading-relaxed rounded-xl outline-none resize-none h-44 h-[210px] font-sans"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER RAILS */}
      <footer className="bg-surface border-t border-border-custom px-5 py-3 text-center text-[10px] text-text-muted tracking-wide font-mono mt-auto relative z-20">
        © 2026 AdminDoc Canvas Pro Inc. • Powered by Google DeepMind Gemini-3.5-Flash
      </footer>

      {/* TOAST SYSTEM OUTLET */}
      <div className="fixed bottom-12 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-panel border border-brand-accent text-text-bright p-3 px-4.5 rounded-xl shadow-2xl flex items-center gap-2.5 transition-all text-xs font-medium animate-fade-in pointer-events-auto"
          >
            <span>{t.icon}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* EDIT MODAL */}
      <EditNodeModal
        isOpen={editingNode !== null}
        node={editingNode}
        onClose={() => setEditingNode(null)}
        onSave={handleUpdateNode}
        onDelete={handleDeleteNode}
      />

      {/* SHARE MODAL */}
      <ShareModal
        nodes={nodes}
        connections={connections}
        compiledPrompt={compiledPrompt}
        cloudNotes={cloudNotes}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onAddCloudNote={(note) => {
          setCloudNotes((prev) => [
            {
              id: `n_${Date.now()}`,
              timestamp: new Date().toLocaleString('zh-TW'),
              title: note.title,
              preview: note.prompt.slice(0, 100) + '...',
              link: note.link,
              prompt: note.prompt,
              docType: docType,
              tone: activeTone,
              isMeeting: note.isMeeting,
            },
            ...prev,
          ]);
        }}
        onToast={triggerToast}
      />

      {/* HELP WINDOW MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div 
            className="bg-panel border border-border-custom max-w-lg w-full p-6 rounded-2xl flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-custom pb-2">
              <h3 className="font-display font-bold text-sm text-text-bright flex items-center gap-2">
                📖 行政文書 Canvas 智慧指南
              </h3>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-text-muted hover:text-text-bright bg-none border-none text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs leading-relaxed text-text-muted flex flex-col gap-3.5 max-h-[380px] overflow-y-auto pr-1">
              <div className="border-l-2 border-brand-accent pl-3">
                <span className="font-bold text-text-bright block mb-1">第一步：設定文書背景</span>
                選擇文書種類（Email、公告、SOP、提案）並填寫核心事實背景。這將成為 AI 行政大腦撰面、精練的決策核心。
              </div>

              <div className="border-l-2 border-brand-coral pl-3">
                <span className="font-bold text-text-bright block mb-1">第二步：畫布視覺排版</span>
                點擊左側「＋」按鈕即可在畫布上生成步驟模組，透過直覺性拖曳順序，或雙擊特定元件變更內容甚至彩度。啟用「有向連結」模式後，依序點選兩個節點，即可搭起前後流程流向。
              </div>

              <div className="border-l-2 border-[#b89dfc] pl-3">
                <span className="font-bold text-text-bright block mb-1">第三步：編譯與生成正文</span>
                點擊「編譯生成 Prompt 與草稿」，系統會根據畫布模組的上下、流向搭起邏輯鏈，一鍵交由 Gemini 生成完美的高通用性公文、郵件、公告範本，免去重複寫信煩惱！
              </div>

              <div className="border-l-2 border-brand-emerald pl-3">
                <span className="font-bold text-text-bright block mb-1">第四步：協作分享與備份</span>
                點擊「分享協作」，可在線上產生即時圖片，甚至將 Prompt 範本同步同步到我們專屬的 GitHub 列印存檔，讓全辦公室一同使用您的心血。
              </div>

              <div className="border-l-2 border-[#fab06d] pl-3">
                <span className="font-bold text-text-bright block mb-1">🎙️ 會議錄音助理</span>
                點擊麥克風即可直接啟動語音轉文字錄製。完成後，交由 AI 自動歸納成「高效率會議記錄」，並支持 Personal Access Token 同步備份至專屬的 GitHub 儲存庫 `s7887631/super-duper-octo-waffle` 目錄下！
              </div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white text-xs py-2.5 rounded-lg font-medium cursor-pointer"
            >
              了解使用，開始排版！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
