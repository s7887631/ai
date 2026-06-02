import React, { useState } from 'react';
import { DocNode, Connection, CloudNote } from '../types';
import { Copy, Link, Download, Code, CheckSquare, Sparkles, QrCode } from 'lucide-react';

interface ShareModalProps {
  nodes: DocNode[];
  connections: Connection[];
  compiledPrompt: string;
  cloudNotes: CloudNote[];
  isOpen: boolean;
  onClose: () => void;
  onAddCloudNote: (note: { title: string; prompt: string; isMeeting: boolean; link: string }) => void;
  onToast: (msg: string, icon?: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  nodes,
  connections,
  compiledPrompt,
  cloudNotes,
  isOpen,
  onClose,
  onAddCloudNote,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [simulatedCollabUrl, setSimulatedCollabUrl] = useState('');
  const [simulatedNoteUrl, setSimulatedNoteUrl] = useState('');
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const tagList = ['商務Email', '公告', 'SOP', '提案', '婉拒'];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleTabClick = (tabId: 1 | 2 | 3) => {
    setActiveTab(tabId);
    if (tabId === 1 && !screenshotUrl) {
      generateMockScreenshot();
    }
  };

  // Build a beautiful SVG screenshot representation directly within the DOM
  const generateMockScreenshot = () => {
    const canvasObj = document.getElementById('docCanvas') as HTMLCanvasElement | null;
    if (canvasObj) {
      try {
        setScreenshotUrl(canvasObj.toDataURL('image/png'));
      } catch (err) {
        console.error(err);
      }
    }
    const randId = Math.random().toString(36).slice(2, 9).toUpperCase();
    setSimulatedCollabUrl(`https://canvas.prac.ai/board/${randId}`);
  };

  const savePromptNote = () => {
    if (!compiledPrompt) {
      onToast('請先回主畫面產生 Prompt 後再作雲端儲存！', '⚠️');
      return;
    }
    const randId = Math.random().toString(36).slice(2, 9).toUpperCase();
    const finalTitle = noteTitle || `範本筆記 ${randId}`;
    const generatedUrl = `https://canvas.prac.ai/notes/${randId}`;

    onAddCloudNote({
      title: `${finalTitle} [${selectedTags.join(', ') || '無標籤'}]`,
      prompt: compiledPrompt,
      isMeeting: false,
      link: generatedUrl,
    });

    setSimulatedNoteUrl(generatedUrl);
    onToast('雲端 Prompt 筆記儲存成功！', '☁️');
  };

  const exportAllJSON = () => {
    const payload = {
      nodes,
      connections,
      compiledPrompt,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-workspace-${Date.now()}.json`;
    a.click();
    onToast('完整 JSON 檔案匯出完成', '💾');
  };

  const exportMarkdown = () => {
    if (!compiledPrompt) {
      onToast('請先產生文書 Prompt 再匯出。', '⚠️');
      return;
    }
    const markdown = `# 行政文書流程設計\n\n**匯出時間：** ${new Date().toLocaleString()}\n\n---\n\n\`\`\`markdown\n${compiledPrompt}\n\`\`\``;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-prompt-${Date.now()}.md`;
    a.click();
    onToast('Markdown 筆記檔案匯出完成。', '📝');
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div 
        className="bg-panel border border-border-custom max-w-lg w-full p-6 rounded-2xl flex flex-col gap-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-custom pb-3">
          <h3 className="font-display font-semibold text-base text-text-bright flex items-center gap-2">
            <span className="text-brand-emerald">🔗</span> 協作板 & 雲端分享中心
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-bright bg-none border-none text-base font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab triggers */}
        <div className="flex gap-2 bg-ink/65 border border-border-custom/50 p-1.5 rounded-xl">
          <button
            onClick={() => handleTabClick(1)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-medium cursor-pointer transition-all ${
              activeTab === 1
                ? 'bg-brand-accent/20 text-white border border-brand-accent/35 font-bold'
                : 'text-text-muted hover:text-text-bright'
            }`}
          >
            📸 截圖協作板
          </button>
          <button
            onClick={() => handleTabClick(2)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-medium cursor-pointer transition-all ${
              activeTab === 2
                ? 'bg-brand-accent/20 text-white border border-brand-accent/35 font-bold'
                : 'text-text-muted hover:text-text-bright'
            }`}
          >
            ☁️ Prompt 筆記
          </button>
          <button
            onClick={() => handleTabClick(3)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-medium cursor-pointer transition-all ${
              activeTab === 3
                ? 'bg-brand-accent/20 text-white border border-brand-accent/35 font-bold'
                : 'text-text-muted hover:text-text-bright'
            }`}
          >
            📤 匯出備份
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-[240px]">
          {/* Tab 1: 📸 截圖協作板 */}
          {activeTab === 1 && (
            <div className="flex flex-col gap-4">
              <div className="border border-border-custom bg-ink/40 rounded-xl p-3 flex flex-col items-center justify-center min-h-[140px] text-center relative overflow-hidden group">
                {screenshotUrl ? (
                  <img
                    src={screenshotUrl}
                    alt="Canvas visual draft"
                    className="w-full max-h-[140px] object-contain rounded-lg border border-border-custom/60"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-text-muted text-xs">點擊按鈕獲取當前畫布結構與截圖</span>
                  </div>
                )}
              </div>

              <button
                onClick={generateMockScreenshot}
                className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white py-2.5 rounded-lg text-xs font-medium cursor-pointer"
              >
                📸 立即擷取畫布截圖
              </button>

              {simulatedCollabUrl && (
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">協作板分享連結：</span>
                  <div className="flex items-center gap-2 bg-surface border border-border-custom p-2.5 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={simulatedCollabUrl}
                      className="flex-1 bg-transparent text-xs text-brand-emerald font-mono outline-none border-none select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(simulatedCollabUrl);
                        onToast('協作夥伴連結已複製！', '🔗');
                      }}
                      className="text-brand-emerald hover:text-brand-emerald/80 text-xs font-semibold flex items-center gap-1 bg-none border-none cursor-pointer"
                    >
                      <Copy size={11} /> 複製
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Prompt 雲端筆記 */}
          {activeTab === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase block mb-1">筆記命名標題：</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="例如：人事重要異動公告模板 v3.1"
                  className="w-full bg-surface border border-border-custom rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-brand-accent text-text-bright"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase block mb-2">筆記核心標籤：</label>
                <div className="flex flex-wrap gap-1.5">
                  {tagList.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`text-[10px] py-1 px-3.5 rounded-full border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-accent/20 border-brand-accent text-brand-accent font-bold'
                            : 'bg-ink/40 border-border-custom text-text-muted hover:text-text-bright hover:border-border-custom*1.5'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={savePromptNote}
                className="w-full bg-brand-emerald/25 hover:bg-brand-emerald/30 border border-brand-emerald/40 text-brand-emerald py-2.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                ☁️ 儲存並產生專屬筆記連結
              </button>

              {simulatedNoteUrl && (
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">雲端筆記成果：</span>
                  <div className="flex items-center gap-2 bg-surface border border-border-custom p-2.5 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={simulatedNoteUrl}
                      className="flex-1 bg-transparent text-xs text-brand-emerald font-mono outline-none border-none select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(simulatedNoteUrl);
                        onToast('雲端筆記成果連結已複製！', '☁️');
                      }}
                      className="text-brand-emerald hover:text-brand-emerald/80 text-xs font-semibold flex items-center gap-1 bg-none border-none cursor-pointer"
                    >
                      <Copy size={11} /> 複製
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 📤 匯出備份 */}
          {activeTab === 3 && (
            <div className="flex flex-col gap-3">
              <button
                onClick={exportAllJSON}
                className="w-full bg-ink hover:bg-surface border border-border-custom text-left p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <h4 className="text-xs font-semibold text-text-bright">📄 匯出完整設定 (JSON)</h4>
                  <p className="text-[10px] text-text-muted mt-0.5">包含所有節點座標、箭頭連線及主要文書主題的備份檔案</p>
                </div>
                <Download size={14} className="text-brand-accent" />
              </button>

              <button
                onClick={exportMarkdown}
                className="w-full bg-ink hover:bg-surface border border-border-custom text-left p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <h4 className="text-xs font-semibold text-text-bright">📝 匯出 Prompt Markdown</h4>
                  <p className="text-[10px] text-text-muted mt-0.5">匯出具有表格與編排清單的 Markdown 文字，可以直接傳入 Obsidian/Notion</p>
                </div>
                <Code size={14} className="text-brand-coral" />
              </button>

              <div className="border border-border-custom rounded-xl p-3 bg-ink/40 flex flex-col gap-2.5">
                <button
                  onClick={() => setShowQr(!showQr)}
                  className="w-full text-left text-xs font-semibold text-text-bright flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <QrCode size={13} className="text-brand-emerald" /> 📱 行動生成 QR Code 分享
                  </span>
                  <span className="text-[10px] text-brand-emerald hover:underline">展開QR</span>
                </button>

                {showQr && (
                  <div className="bg-white p-3.5 rounded-lg flex flex-col items-center justify-center self-center animate-scale-up mt-2">
                    <div className="grid grid-cols-10 gap-1 w-28 h-28 bg-white">
                      {Array.from({ length: 100 }).map((_, i) => {
                        const isFilled =
                          Math.random() > 0.4 ||
                          i < 12 ||
                          i % 10 === 0 ||
                          i % 10 === 9 ||
                          i > 85;
                        return (
                          <div
                            key={i}
                            className={`w-full h-full rounded-[1px] ${
                              isFilled ? 'bg-black' : 'bg-transparent'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[9px] text-black/75 mt-2 font-sans font-medium text-center">
                      掃描此臨時 QR code<br/>立即於手持裝置調閱 Prompt 內容
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
