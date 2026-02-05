import React from 'react'

function ConductorEmblem({ className, width = 48, height = 48 }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="14" r="5" stroke="#2d5a87" strokeWidth="1.4" fill="none" />
      <path d="M24 19 v14" stroke="#2d5a87" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24 26 L12 20" stroke="#2d5a87" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 26 L36 20" stroke="#2d5a87" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 26 L24 10 L30 8" stroke="#2d5a87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="8" r="1.5" fill="#2d5a87" />
    </svg>
  )
}

export default ConductorEmblem
