interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" fill="#F5F8FD" stroke="#D8E2F0" strokeWidth="1.5" />
      <path d="M7.5 6.75h8.7c4.55 0 7.3 1.85 7.3 5.05 0 1.8-.9 3.2-2.55 4.05-1.15.6-2.55.9-4.25.9H7.5v-10Z" fill="#24344D" />
      <path d="M7.5 15.25h9.2c1.7 0 3.1.3 4.25.9 1.65.85 2.55 2.25 2.55 4.05 0 3.2-2.75 5.05-7.3 5.05H7.5v-10Z" fill="#2563EB" />
      <path d="M11.25 10.25h5.05c1.75 0 2.85.55 2.85 1.65s-1.1 1.65-2.85 1.65h-5.05v-3.3Z" fill="#F5F8FD" />
      <path d="M11.25 18.45h5.45c1.75 0 2.85.55 2.85 1.65s-1.1 1.65-2.85 1.65h-5.45v-3.3Z" fill="#F5F8FD" />
    </svg>
  )
}
