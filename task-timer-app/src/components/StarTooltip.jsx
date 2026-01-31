import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './StarTooltip.css';

function StarTooltip({ children, content, position }) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const groupRef = useRef(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgRect = e.currentTarget.closest('svg').getBoundingClientRect();
    setTooltipPos({ 
      x: rect.left + rect.width / 2, 
      y: rect.top 
    });
    setIsVisible(true);
  };

  return (
    <>
      <g
        ref={groupRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </g>
      {isVisible && createPortal(
        <div 
          className="star-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

export default StarTooltip;
