import React, { useState, useEffect } from 'react';
import { DocNode } from '../types';
import { COLOR_PALETTE } from '../constants';
import { Trash2, Save, X } from 'lucide-react';

interface EditNodeModalProps {
  isOpen: boolean;
  node: DocNode | null;
  onClose: () => void;
  onSave: (nodeId: string, text: string, color: string) => void;
  onDelete: (nodeId: string) => void;
}

export const EditNodeModal: React.FC<EditNodeModalProps> = ({
  isOpen,
  node,
  onClose,
  onSave,
  onDelete,
}) => {
  const [text, setText] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (node) {
      setText(node.text);
      setColor(node.color);
    }
  }, [node, isOpen]);

  if (!isOpen || !node) return null;

  const handleSave = () => {
    onSave(node.id, text, color);
    onClose();
  };

  const handleDelete = () => {
    onDelete(node.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-panel border border-border-custom max-w-sm w-full p-5 rounded-2xl flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-custom pb-2">
          <h4 className="font-display font-semibold text-sm text-text-bright flex items-center gap-1.5">
            <span>✏️</span> 編輯畫布區塊
          </h4>
          <button onClick={onClose} className="text-text-muted hover:text-text-bright">
            <X size={15} />
          </button>
        </div>

        <div>
          <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase block mb-1">
            區塊文字內容：
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="請輸入節點流程標題或文字"
            className="w-full bg-surface border border-border-custom focus:border-brand-accent rounded-lg text-xs p-2.5 text-text-bright focus:outline-none leading-relaxed font-sans"
          />
        </div>

        <div>
          <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase block mb-2">
            區塊代表彩度：
          </label>
          <div className="flex gap-2 justify-between">
            {COLOR_PALETTE.map((c) => {
              const isSelected = color === c;
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full cursor-pointer transition-transform relative ${
                    isSelected ? 'scale-110 shadow-lg' : 'hover:scale-105'
                  }`}
                  type="button"
                >
                  {isSelected && (
                    <span className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white text-xs py-2 px-4 rounded-lg font-medium flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={12} /> 儲存
          </button>
          
          <button
            onClick={handleDelete}
            className="bg-red-950/20 hover:bg-red-950/30 border border-red-800/20 text-red-400 text-xs py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1 cursor-pointer"
            title="刪除此節點與連線"
          >
            <Trash2 size={12} /> 刪除
          </button>

          <button
            onClick={onClose}
            className="bg-ink hover:bg-surface border border-border-custom text-text-bright text-xs py-2 px-3 rounded-lg font-medium cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
