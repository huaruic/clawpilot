import React from 'react'

interface CatMascotProps {
  mode: 'wagging'
  className?: string
}

export const CatMascot: React.FC<CatMascotProps> = ({ mode, className = '' }) => {
  if (mode === 'wagging') {
    return (
      <div className={`flex items-end gap-2 ${className}`}>
        <svg
          viewBox="0 0 60 60"
          className="w-12 h-12 overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body (back view) */}
          <path d="M15 55C15 30 45 30 45 55" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          {/* Head */}
          <circle cx="30" cy="35" r="12" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          <path d="M22 28L18 18L28 24Z" fill="#F97316" stroke="#C2410C" />
          <path d="M38 28L42 18L32 24Z" fill="#F97316" stroke="#C2410C" />
          
          {/* Tail */}
          <path 
            id="cat-tail"
            d="M40 50C55 50 55 35 45 35" 
            stroke="#F97316" 
            strokeWidth="6" 
            strokeLinecap="round"
            className="origin-[40px_50px] animate-tail-wag"
          />
        </svg>
        <style>{`
          @keyframes tail-wag {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-20deg); }
          }
          .animate-tail-wag {
            animation: tail-wag 0.8s ease-in-out infinite;
          }
        `}</style>
      </div>
    )
  }

  return null
}
