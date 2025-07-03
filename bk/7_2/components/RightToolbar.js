// src/components/RightToolbar.js
import React from 'react';
import StealthIcon from './StealthIcon';

const RightToolbar = ({ isDarkMode }) => {
  return (
    <div className="right-toolbar">
      <button className="toolbar-icon-button">
        {/* The icon's color will be controlled by CSS */}
        <StealthIcon className="stealth-icon" />
      </button>
      {/* Other toolbar icons can be added here in the future */}
    </div>
  );
};

export default RightToolbar;