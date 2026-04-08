import React from 'react'

interface CatMascotProps {
  mode: 'peeking' | 'wagging' | 'lounging'
  className?: string
}

export const CatMascot: React.FC<CatMascotProps> = ({ mode, className = '' }) => {
  if (mode === 'peeking') {
    return (
      <div className={`relative ${className}`}>
        <svg
          viewBox="0 0 100 60"
          className="w-24 h-auto overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ears */}
          <path d="M20 30L10 10L35 25Z" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          <path d="M80 30L90 10L65 25Z" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          
          {/* Head */}
          <path d="M15 50C15 30 85 30 85 50" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          
          {/* Eyes */}
          <g className="animate-bounce-slight">
             <circle cx="35" cy="42" r="3" fill="#1F2937" />
             <circle cx="65" cy="42" r="3" fill="#1F2937" />
          </g>
          
          {/* Paws */}
          <rect x="25" y="48" width="12" height="8" rx="4" fill="#FDBA74" stroke="#C2410C" />
          <rect x="63" y="48" width="12" height="8" rx="4" fill="#FDBA74" stroke="#C2410C" />
        </svg>
        <style>{`
          @keyframes bounce-slight {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1px); }
          }
          .animate-bounce-slight {
            animation: bounce-slight 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    )
  }

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

  if (mode === 'lounging') {
    return (
      <div className={`relative ${className}`}>
        <svg
          viewBox="0 0 200 120"
          className="w-48 h-auto overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body */}
          <path d="M40 90C40 60 160 60 160 90H40Z" fill="#F97316" stroke="#C2410C" strokeWidth="3" />
          {/* Head */}
          <circle cx="160" cy="75" r="25" fill="#F97316" stroke="#C2410C" strokeWidth="3" />
          <path d="M145 60L135 40L155 55Z" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          <path d="M175 60L185 40L165 55Z" fill="#F97316" stroke="#C2410C" strokeWidth="2" />
          
          {/* Closed Eyes (sleeping) */}
          <path d="M150 75C150 75 153 78 156 75" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
          <path d="M164 75C164 75 167 78 170 75" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
          
          {/* Tail */}
          <path 
            d="M45 90C20 90 20 60 40 60" 
            stroke="#F97316" 
            strokeWidth="10" 
            strokeLinecap="round"
            className="origin-[45px_90px] animate-tail-slow"
          />
          
          {/* ZZZ */}
          <g className="animate-zzz opacity-0">
            <text x="180" y="30" fill="#C2410C" fontSize="12" fontWeight="bold">Z</text>
            <text x="190" y="20" fill="#C2410C" fontSize="16" fontWeight="bold">Z</text>
          </g>
        </svg>
        <style>{`
          @keyframes tail-slow {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-10deg); }
          }
          @keyframes zzz {
            0% { transform: translate(0, 0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translate(10px, -20px); opacity: 0; }
          }
          .animate-tail-slow { animation: tail-slow 3s ease-in-out infinite; }
          .animate-zzz { animation: zzz 4s ease-in-out infinite; }
        `}</style>
      </div>
    )
  }

  return null
}
