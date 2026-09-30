const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve styles and JavaScript files from src directory
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/js', express.static(path.join(__dirname, 'src', 'js')));
app.use('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'styles.css'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Placify Frontend dev server running on http://localhost:${PORT}`);
});
