import React from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css'; // You can keep a basic index.css if you want
import App from './App';
import * as serviceWorker from './serviceWorker'; // Make sure this line exists

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// MODIFIED: Change this from .unregister() to .register() to activate the PWA
serviceWorker.register();