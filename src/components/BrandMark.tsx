interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 220"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28 58V28h48M28 166v26h164v-26" fill="none" stroke="#222222" strokeLinecap="square" strokeWidth="14" />
      <g fill="#777777">
        <rect x="34" y="70" width="38" height="22"/><rect x="34" y="100" width="38" height="22"/><rect x="34" y="130" width="38" height="22"/>
        <rect x="150" y="70" width="38" height="22"/><rect x="150" y="100" width="38" height="22"/><rect x="150" y="130" width="38" height="22"/>
      </g>
      <g fill="#222222">
        <rect x="92" y="70" width="38" height="22"/><rect x="92" y="100" width="38" height="22"/><rect x="92" y="130" width="38" height="22"/>
      </g>
    </svg>
  )
}
