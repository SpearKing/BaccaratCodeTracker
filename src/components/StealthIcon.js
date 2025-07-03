// src/components/StealthIcon.js
import React from 'react';

const StealthIcon = ({ className }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 100 75" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M50 0 L95 60 L65 60 L50 45 L35 60 L5 60 Z" 
      />
    </svg>
  );
};

export default StealthIcon;