// ===============================
// 📁 main.js
// ===============================
import { bindUI } from './ui.js';
import { state } from './state.js';

window.appState = state;

bindUI();