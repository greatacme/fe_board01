import React from 'react';
import './Inventory.css';

const Inventory = ({ pieces, onInventoryClick, playerColor, selectedPiece, isPlaying }) => {
  const rows = 7;
  const cols = 5;

  const drawPiece = (piece, ctx, x, y, cellSize) => {
    if (!piece) return;

    const centerX = x + cellSize / 2;
    const centerY = y + cellSize / 2;

    // Draw pentagon
    ctx.beginPath();
    if (piece.color === 'RED') {
      // RED: pointing right
      ctx.moveTo(centerX - 18, centerY - 20);
      ctx.lineTo(centerX - 18, centerY + 20);
      ctx.lineTo(centerX + 12, centerY + 14);
      ctx.lineTo(centerX + 20, centerY);
      ctx.lineTo(centerX + 12, centerY - 14);
    } else {
      // BLUE: pointing left
      ctx.moveTo(centerX + 18, centerY - 20);
      ctx.lineTo(centerX + 18, centerY + 20);
      ctx.lineTo(centerX - 12, centerY + 14);
      ctx.lineTo(centerX - 20, centerY);
      ctx.lineTo(centerX - 12, centerY - 14);
    }
    ctx.closePath();

    // Fill color
    ctx.fillStyle = piece.color === 'RED' ? '#d32f2f' : '#2196F3';
    ctx.fill();

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw symbol and name
    if (piece.type) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000';

      // Symbol
      if (piece.type.symbol) {
        ctx.font = 'bold 14px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 0.5;
        ctx.strokeText(piece.type.symbol, centerX, centerY - 5);
        ctx.fillText(piece.type.symbol, centerX, centerY - 5);
      }

      // Korean name
      if (piece.type.koreanName) {
        ctx.font = 'bold 7px sans-serif';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 0.3;
        ctx.strokeText(piece.type.koreanName, centerX, centerY + 5);
        ctx.fillText(piece.type.koreanName, centerX, centerY + 5);
      }
    }
  };

  React.useEffect(() => {
    const canvas = document.getElementById('inventory-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cellSize = 60;

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellSize);
      ctx.lineTo(cols * cellSize, row * cellSize);
      ctx.stroke();
    }

    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellSize, 0);
      ctx.lineTo(col * cellSize, rows * cellSize);
      ctx.stroke();
    }

    let piecesToDisplay = [];

    if (isPlaying) {
      // During PLAYING: show captured opponent pieces
      piecesToDisplay = pieces.filter(p =>
        p.captured && p.color !== playerColor
      );
    } else {
      // During SETUP: show pieces in inventory (not yet placed)
      piecesToDisplay = pieces.filter(p =>
        (p.position === null || p.position === undefined) &&
        p.inventoryIndex !== undefined
      );

      console.log('=== Inventory Render (SETUP) ===');
      console.log('Total pieces:', pieces.length);
      console.log('Pieces to display:', piecesToDisplay.length);
      console.log('Player color:', playerColor);
      if (piecesToDisplay.length > 0) {
        console.log('First piece to display:', piecesToDisplay[0]);
      }
    }

    // Draw pieces
    piecesToDisplay.forEach((piece, visualIndex) => {
      let index;
      if (isPlaying) {
        // For captured pieces, use inventoryIndex if available, otherwise sequential
        index = piece.inventoryIndex !== undefined ? piece.inventoryIndex : visualIndex;
      } else {
        // For setup, use inventoryIndex
        index = piece.inventoryIndex;
      }

      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellSize;
      const y = row * cellSize;
      drawPiece(piece, ctx, x, y, cellSize);

      // Highlight selected piece with green border
      if (selectedPiece && selectedPiece.id === piece.id) {
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        ctx.beginPath();
        if (piece.color === 'RED') {
          // RED: pointing right
          ctx.moveTo(centerX - 22, centerY - 24);
          ctx.lineTo(centerX - 22, centerY + 24);
          ctx.lineTo(centerX + 16, centerY + 18);
          ctx.lineTo(centerX + 24, centerY);
          ctx.lineTo(centerX + 16, centerY - 18);
        } else {
          // BLUE: pointing left
          ctx.moveTo(centerX + 22, centerY - 24);
          ctx.lineTo(centerX + 22, centerY + 24);
          ctx.lineTo(centerX - 16, centerY + 18);
          ctx.lineTo(centerX - 24, centerY);
          ctx.lineTo(centerX - 16, centerY - 18);
        }
        ctx.closePath();
        ctx.strokeStyle = '#00ff00'; // Green highlight
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }, [pieces, selectedPiece, isPlaying, playerColor]);

  const handleCanvasClick = (e) => {
    const canvas = document.getElementById('inventory-canvas');
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cellSize = 60;
    const col = Math.floor(clickX / cellSize);
    const row = Math.floor(clickY / cellSize);
    const clickedIndex = row * cols + col;

    let piece = null;

    if (isPlaying) {
      // During PLAYING: find captured piece at this inventory position
      piece = pieces.find(p =>
        p.captured && p.color !== playerColor &&
        p.inventoryIndex === clickedIndex
      );
    } else {
      // During SETUP: find piece in inventory (not yet placed)
      piece = pieces.find(p =>
        (!p.position || p.position === null || p.position === undefined) &&
        p.inventoryIndex === clickedIndex
      );
    }

    // Call handler with piece (null if empty area) and clicked index
    if (onInventoryClick) {
      onInventoryClick(piece || null, clickedIndex);
    }
  };

  return (
    <div className="inventory-container">
      <h3>{isPlaying ? `잡은 말 (${playerColor})` : `인벤토리 (${playerColor})`}</h3>
      <canvas
        id="inventory-canvas"
        width={cols * 60}
        height={rows * 60}
        onClick={handleCanvasClick}
        className="inventory-canvas"
      />
      {!isPlaying && (
        <p className="inventory-hint">말을 클릭하여 선택 → 보드에 배치 | 보드 말 선택 → 인벤토리 원하는 빈 공간 클릭으로 이동</p>
      )}
      {isPlaying && (
        <p className="inventory-hint">상대방에게서 따낸 말들 | 말 클릭 → 다른 위치 클릭으로 재배치</p>
      )}
    </div>
  );
};

export default Inventory;
