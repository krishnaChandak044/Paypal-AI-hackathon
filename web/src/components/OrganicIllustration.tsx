import React from 'react';

export const HeartInHandsSvg: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M24 16.5C21.5 13.5 17 13.5 14.5 16C12 18.5 12 22.5 14.5 25L24 34.5L33.5 25C36 22.5 36 18.5 33.5 16C31 13.5 26.5 13.5 24 16.5Z"
      fill="#C86D4D"
      stroke="#B05335"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 29C11 28 15 30 19 32.5L24 35.5L29 32.5C33 30 37 28 40 29C42 29.5 43 32 41 34L35 39C30 43 25 43 20 40L9 33C7.5 31.5 7 29.5 8 29Z"
      stroke="#524436"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#FAF8F5"
    />
  </svg>
);

export const CommunityShelterSvg: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 24L24 8L42 24"
      stroke="#C86D4D"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 21V38C11 39.1 11.9 40 13 40H35C36.1 40 37 39.1 37 38V21"
      stroke="#524436"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 40V28C20 26.9 20.9 26 22 26H26C27.1 26 28 26.9 28 28V40"
      stroke="#556D56"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const HandDrawnCheck: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 12.5C6.5 13.5 8 16 9.5 18C12 13 16 8 20 5"
      stroke="#556D56"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const HandDrawnSparkle: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C12.5 7 15 9.5 20 10C15 10.5 12.5 13 12 18C11.5 13 9 10.5 4 10C9 9.5 11.5 7 12 2Z"
      fill="#C86D4D"
      opacity="0.85"
    />
  </svg>
);
