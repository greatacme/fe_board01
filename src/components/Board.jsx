import React, { useRef, useEffect } from 'react';
import './Board.css';

const Board = ({ pieces, onPieceClick, selectedPiece, currentTurn, playerColor }) => {
  const canvasRef = useRef(null);
  const cellSize = 60;
  const padding = 40;
  const gapSize = 80; // Gap between left and right boards
  const boardWidth = 6; // Each board is 6 columns wide (x: 0-5)
  const boardHeight = 7; // Each board is 7 rows tall (y: 0-6)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    drawBoard(ctx);
    drawPieces(ctx);
  }, [pieces, selectedPiece]);

  const getCanvasX = (gridX) => {
    if (gridX <= 5) {
      // Left board (RED): x: 0-5
      return padding + gridX * cellSize;
    } else if (gridX === 6.5) {
      // Diagonal crossing point (center of gap)
      return padding + 5 * cellSize + gapSize / 2;
    } else {
      // Right board (BLUE): x: 8-13
      return padding + 5 * cellSize + gapSize + (gridX - 8) * cellSize;
    }
  };

  const getCanvasY = (gridY) => {
    // Support fractional coordinates (e.g., 1.5, 4.5)
    return padding + gridY * cellSize;
  };

  const drawBoard = (ctx) => {
    // Clear with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    // Draw left board (RED): x: 0-5, y: 0-6
    // Horizontal lines
    for (let y = 0; y < boardHeight; y++) {
      const canvasY = getCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(getCanvasX(0), canvasY);
      ctx.lineTo(getCanvasX(5), canvasY);
      ctx.stroke();
    }

    // Vertical lines
    for (let x = 0; x < boardWidth; x++) {
      const canvasX = getCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(canvasX, getCanvasY(0));
      ctx.lineTo(canvasX, getCanvasY(boardHeight - 1));
      ctx.stroke();
    }

    // Draw right board (BLUE): x: 8-13, y: 0-6
    // Horizontal lines
    for (let y = 0; y < boardHeight; y++) {
      const canvasY = getCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(getCanvasX(8), canvasY);
      ctx.lineTo(getCanvasX(13), canvasY);
      ctx.stroke();
    }

    // Vertical lines
    for (let x = 8; x < 8 + boardWidth; x++) {
      const canvasX = getCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(canvasX, getCanvasY(0));
      ctx.lineTo(canvasX, getCanvasY(boardHeight - 1));
      ctx.stroke();
    }

    // Draw diagonal connecting left (5,1) to right (8,2)
    drawConnectingDiagonal(ctx);

    // Draw middle crossing points
    drawMiddleCrossingPoints(ctx);
  };

  const drawConnectingDiagonal = (ctx) => {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    // First diagonal: Left board (5,1) to right board (8,2)
    const left1X = getCanvasX(5);
    const left1Y = getCanvasY(1);
    const right1X = getCanvasX(8);
    const right1Y = getCanvasY(2);

    ctx.beginPath();
    ctx.moveTo(left1X, left1Y);
    ctx.lineTo(right1X, right1Y);
    ctx.stroke();

    // Second diagonal: Left board (5,2) to right board (8,1)
    const left2X = getCanvasX(5);
    const left2Y = getCanvasY(2);
    const right2X = getCanvasX(8);
    const right2Y = getCanvasY(1);

    ctx.beginPath();
    ctx.moveTo(left2X, left2Y);
    ctx.lineTo(right2X, right2Y);
    ctx.stroke();

    // Third diagonal: Left board (5,4) to right board (8,5)
    const left3X = getCanvasX(5);
    const left3Y = getCanvasY(4);
    const right3X = getCanvasX(8);
    const right3Y = getCanvasY(5);

    ctx.beginPath();
    ctx.moveTo(left3X, left3Y);
    ctx.lineTo(right3X, right3Y);
    ctx.stroke();

    // Fourth diagonal: Left board (5,5) to right board (8,4)
    const left4X = getCanvasX(5);
    const left4Y = getCanvasY(5);
    const right4X = getCanvasX(8);
    const right4Y = getCanvasY(4);

    ctx.beginPath();
    ctx.moveTo(left4X, left4Y);
    ctx.lineTo(right4X, right4Y);
    ctx.stroke();
  };

  const drawMiddleCrossingPoints = (ctx) => {
    // Draw circles at diagonal crossing points: (6.5, 1.5) and (6.5, 4.5)
    ctx.fillStyle = '#FF9800'; // Orange color for visibility
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    for (let y of [1.5, 4.5]) {
      const canvasX = getCanvasX(6.5);
      const canvasY = getCanvasY(y);

      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  const drawPieces = (ctx) => {
    if (!pieces) return;

    pieces.forEach(piece => {
      if (piece.captured) return;

      // Skip pieces that haven't been placed yet (position is null)
      if (!piece.position || piece.position.x === null || piece.position.x === undefined) {
        return;
      }

      const x = getCanvasX(piece.position.x);
      const y = getCanvasY(piece.position.y);

      // Draw pentagon (Japanese shogi-style piece) facing each other
      ctx.beginPath();
      if (piece.color === 'RED') {
        // RED: pointing right (towards opponent)
        ctx.moveTo(x - 18, y - 20);        // Left top
        ctx.lineTo(x - 18, y + 20);        // Left bottom
        ctx.lineTo(x + 12, y + 14);        // Bottom right
        ctx.lineTo(x + 20, y);             // Right (pointed)
        ctx.lineTo(x + 12, y - 14);        // Top right
      } else {
        // BLUE: pointing left (towards opponent)
        ctx.moveTo(x + 18, y - 20);        // Right top
        ctx.lineTo(x + 18, y + 20);        // Right bottom
        ctx.lineTo(x - 12, y + 14);        // Bottom left
        ctx.lineTo(x - 20, y);             // Left (pointed)
        ctx.lineTo(x - 12, y - 14);        // Top left
      }
      ctx.closePath();

      // Check if piece is hidden (opponent piece that is not revealed)
      // Revealed pieces show their type even if they belong to opponent
      const isHidden = !piece.type || (piece.color !== playerColor && !piece.revealed);

      // Fill color based on piece color
      if (isHidden) {
        // Hidden piece - show as gray/dark color
        ctx.fillStyle = piece.color === 'RED' ? '#8B4513' : '#4A5568';
      } else {
        // Visible piece - show normal colors
        if (piece.color === 'RED') {
          ctx.fillStyle = '#d32f2f'; // Red
        } else {
          ctx.fillStyle = '#2196F3'; // Blue
        }
      }
      ctx.fill();

      // Draw border - use orange for revealed own pieces
      if (piece.color === playerColor && piece.revealed) {
        ctx.strokeStyle = '#FF9800'; // Orange for revealed own pieces (shown to opponent)
        ctx.lineWidth = 3; // Slightly thicker to make it more visible
      } else {
        ctx.strokeStyle = '#000'; // Black for normal pieces
        ctx.lineWidth = 2;
      }
      ctx.stroke();

      if (!isHidden && piece.type) {
        // Draw piece symbol and name for visible piece
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF'; // White text
        ctx.strokeStyle = '#000'; // Black outline for text

        // Draw symbol (top, larger)
        if (piece.type.symbol) {
          ctx.font = 'bold 16px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 0.5;
          ctx.strokeText(piece.type.symbol, x, y - 6);
          ctx.fillText(piece.type.symbol, x, y - 6);
        }

        // Draw korean name (bottom, smaller)
        if (piece.type.koreanName) {
          ctx.font = 'bold 8px sans-serif';
          ctx.textBaseline = 'top';
          ctx.lineWidth = 0.3;
          ctx.strokeText(piece.type.koreanName, x, y + 6);
          ctx.fillText(piece.type.koreanName, x, y + 6);
        }
      }

      // Highlight selected piece
      if (selectedPiece && selectedPiece.position &&
          selectedPiece.position.x === piece.position.x &&
          selectedPiece.position.y === piece.position.y) {
        ctx.beginPath();
        if (piece.color === 'RED') {
          ctx.moveTo(x - 22, y - 24);
          ctx.lineTo(x - 22, y + 24);
          ctx.lineTo(x + 16, y + 18);
          ctx.lineTo(x + 24, y);
          ctx.lineTo(x + 16, y - 18);
        } else {
          ctx.moveTo(x + 22, y - 24);
          ctx.lineTo(x + 22, y + 24);
          ctx.lineTo(x - 16, y + 18);
          ctx.lineTo(x - 24, y);
          ctx.lineTo(x - 16, y - 18);
        }
        ctx.closePath();
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  };

  const findClosestGridPosition = (clickX, clickY) => {
    // Find closest grid position
    let minDist = Infinity;
    let closestX = 0;
    let closestY = 0;

    // Check left board (x: 0-5)
    for (let x = 0; x <= 5; x++) {
      for (let y = 0; y < boardHeight; y++) {
        const canvasX = getCanvasX(x);
        const canvasY = getCanvasY(y);
        const dist = Math.sqrt(
          Math.pow(clickX - canvasX, 2) + Math.pow(clickY - canvasY, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          closestX = x;
          closestY = y;
        }
      }
    }

    // Check diagonal crossing points: (6.5, 1.5) and (6.5, 4.5)
    for (let y of [1.5, 4.5]) {
      const canvasX = getCanvasX(6.5);
      const canvasY = getCanvasY(y);
      const dist = Math.sqrt(
        Math.pow(clickX - canvasX, 2) + Math.pow(clickY - canvasY, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        closestX = 6.5;
        closestY = y;
      }
    }

    // Check right board (x: 8-13)
    for (let x = 8; x <= 13; x++) {
      for (let y = 0; y < boardHeight; y++) {
        const canvasX = getCanvasX(x);
        const canvasY = getCanvasY(y);
        const dist = Math.sqrt(
          Math.pow(clickX - canvasX, 2) + Math.pow(clickY - canvasY, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          closestX = x;
          closestY = y;
        }
      }
    }

    return { closestX, closestY, minDist };
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { closestX, closestY, minDist } = findClosestGridPosition(clickX, clickY);

    // Only accept clicks within reasonable distance
    if (minDist < cellSize / 2) {
      onPieceClick(closestX, closestY);
    }
  };

  const canvasWidth = getCanvasX(13) + padding;
  const canvasHeight = getCanvasY(boardHeight - 1) + padding;

  return (
    <div className="board-container">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
        className="janggi-board"
      />
    </div>
  );
};

export default Board;
