import React, { useRef, useEffect, useState } from 'react';
import { DocNode, Connection } from '../types';
import { COLOR_PALETTE } from '../constants';

interface DocCanvasProps {
  nodes: DocNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  arrowMode: boolean;
  onUpdateNodes: (nodes: DocNode[]) => void;
  onUpdateConnections: (connections: Connection[]) => void;
  onSelectNode: (id: string | null) => void;
  onDoubleClickNode: (node: DocNode) => void;
  onAddConnection: (from: string, to: string) => void;
}

export const DocCanvas: React.FC<DocCanvasProps> = ({
  nodes,
  connections,
  selectedNodeId,
  arrowMode,
  onUpdateNodes,
  onUpdateConnections,
  onSelectNode,
  onDoubleClickNode,
  onAddConnection,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connStartId, setConnStartId] = useState<string | null>(null);

  // Auto resize canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawCanvas();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [nodes, connections, selectedNodeId, connStartId, arrowMode]);

  // Helper for rounded rectangle
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Helper for text wrapping in Canvas
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineHeight: number
  ) => {
    const chars = text.split('');
    let line = '';
    const lines: string[] = [];

    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxW && n > 0) {
        lines.push(line);
        line = chars[n];
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let k = 0; k < lines.length; k++) {
      ctx.fillText(lines[k], x, startY + k * lineHeight);
    }
  };

  // Helper to draw clean visual flow arrows
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    tx: number,
    ty: number
  ) => {
    const headLength = 10;
    const dx = tx - fx;
    const dy = ty - fy;
    const angle = Math.atan2(dy, dx);
    const pad = 48; // Space from node center to bypass border overlaps

    const sx = fx + pad * Math.cos(angle);
    const sy = fy + pad * Math.sin(angle);
    const ex = tx - pad * Math.cos(angle);
    const ey = ty - pad * Math.sin(angle);

    ctx.save();
    ctx.strokeStyle = 'rgba(168, 157, 252, 0.7)';
    ctx.fillStyle = 'rgba(168, 157, 252, 0.7)';
    ctx.lineWidth = 2.5;

    // Draw main arrow segment
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Draw arrow tip
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - headLength * Math.cos(angle - Math.PI / 6),
      ey - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      ex - headLength * Math.cos(angle + Math.PI / 6),
      ey - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw connections
    connections.forEach((conn) => {
      const fromNode = nodes.find((n) => n.id === conn.from);
      const toNode = nodes.find((n) => n.id === conn.to);
      if (fromNode && toNode) {
        drawArrow(
          ctx,
          fromNode.x + fromNode.w / 2,
          fromNode.y + fromNode.h / 2,
          toNode.x + toNode.w / 2,
          toNode.y + toNode.h / 2
        );
      }
    });

    // 2. Draw nodes
    nodes.forEach((node) => {
      ctx.save();
      // Drop shadow for realistic visual depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = node.color;
      roundRect(ctx, node.x, node.y, node.w, node.h, 12);
      ctx.fill();

      // Highlight active node outline
      if (selectedNodeId === node.id) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();

      // Add high-contrast white stylized typography
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '600 12px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrapText(
        ctx,
        node.text,
        node.x + node.w / 2,
        node.y + node.h / 2,
        node.w - 18,
        16
      );
    });

    // 3. Highlight connection start node
    if (arrowMode && connStartId) {
      const activeStart = nodes.find((n) => n.id === connStartId);
      if (activeStart) {
        ctx.save();
        ctx.strokeStyle = '#6dfabc';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
        roundRect(
          ctx,
          activeStart.x - 3,
          activeStart.y - 3,
          activeStart.w + 6,
          activeStart.h + 6,
          14
        );
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  // Find node at relative mouse coordinate
  const getNodeAt = (x: number, y: number): DocNode | null => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (
        x >= node.x &&
        x <= node.x + node.w &&
        y >= node.y &&
        y <= node.y + node.h
      ) {
        return node;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const targetNode = getNodeAt(x, y);

    if (arrowMode) {
      if (targetNode) {
        if (!connStartId) {
          setConnStartId(targetNode.id);
        } else if (connStartId !== targetNode.id) {
          onAddConnection(connStartId, targetNode.id);
          setConnStartId(null);
        }
      } else {
        setConnStartId(null);
      }
      return;
    }

    if (targetNode) {
      onSelectNode(targetNode.id);
      setDraggingNode(targetNode.id);
      setDragOffset({
        x: x - targetNode.x,
        y: y - targetNode.y,
      });

      // Move selected node to top of render queue
      const otherNodes = nodes.filter((n) => n.id !== targetNode.id);
      onUpdateNodes([...otherNodes, targetNode]);
    } else {
      onSelectNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingNode || arrowMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dragTarget = nodes.find((n) => n.id === draggingNode);
    if (dragTarget) {
      const newX = Math.max(8, Math.min(canvas.width - dragTarget.w - 8, x - dragOffset.x));
      const newY = Math.max(8, Math.min(canvas.height - dragTarget.h - 8, y - dragOffset.y));

      const updatedNodes = nodes.map((n) =>
        n.id === draggingNode ? { ...n, x: newX, y: newY } : n
      );
      onUpdateNodes(updatedNodes);
    }
  };

  const handleMouseUpOrLeave = () => {
    setDraggingNode(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const targetNode = getNodeAt(x, y);
    if (targetNode) {
      onDoubleClickNode(targetNode);
    }
  };

  // Support responsive touch interactions
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!e.touches.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    const targetNode = getNodeAt(x, y);
    if (targetNode && !arrowMode) {
      onSelectNode(targetNode.id);
      setDraggingNode(targetNode.id);
      setDragOffset({
        x: x - targetNode.x,
        y: y - targetNode.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!draggingNode || !e.touches.length || arrowMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    const dragTarget = nodes.find((n) => n.id === draggingNode);
    if (dragTarget) {
      const newX = Math.max(8, Math.min(canvas.width - dragTarget.w - 8, x - dragOffset.x));
      const newY = Math.max(8, Math.min(canvas.height - dragTarget.h - 8, y - dragOffset.y));

      const updatedNodes = nodes.map((n) =>
        n.id === draggingNode ? { ...n, x: newX, y: newY } : n
      );
      onUpdateNodes(updatedNodes);
    }
  };

  // Trigger drawing updates whenever items change
  useEffect(() => {
    drawCanvas();
  }, [nodes, connections, selectedNodeId, connStartId, arrowMode]);

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="block w-full h-full canvas-bg rounded-xl border border-border-custom"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
      />
    </div>
  );
};
