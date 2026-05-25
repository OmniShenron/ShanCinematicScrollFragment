import { App } from './App.js';
import './style.css';

const canvas = document.getElementById('webgl');
if (canvas) {
  new App(canvas);
} else {
  console.error("Canvas element #webgl not found.");
}
