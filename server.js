const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024';

const initialDatabase = {
  "0016": ["Pillowcase", "Marketing Pillowcase"],
  "0319": [],
  "0303": ["Circle Graph (Monthly Budget)"],
  "0097": ["Circle Graph (Monthly Budget)" , "Project Plan (Pillowcase)" , "Marketing Pillowcase" ],
  "0315": ["Circle Graph (Monthly Budget)" , "Project Plan (Pillowcase)" , "Marketing Pillowcase" ],
  "0009": ["Marketing Pillowcase"],
  "0086": ["Circle Graph (Monthly Budget)"],
  "0134": [],
  "0288": ["Circle Graph (Monthly Budget)" , "Project Plan (Pillowcase)" , "Pillowcase" , "Marketing Pillowcase" ],
  "0051": ["Marketing Pillowcase"],
  "0021": ["Pillowcase"],
  "0089": [],
  "0313": ["Marketing Pillowcase"],
  "0004": [],
  "0135": ["Pillowcase", "Marketing Pillowcase"],
  "0075": [],
  "0061": ["Circle Graph (Monthly Budget)" , "Project Plan (Pillowcase)" , "Pillowcase" , "Marketing Pillowcase" ],
  "0267": ["Collage (Family Resources)" , "Marketing Pillowcase"],
  "0266": ["Collage (Family Resources)" , "Project Plan (Pillowcase)" , "Marketing Pillowcase"],
  "0103": ["Circle Graph (Monthly Budget)" , "Marketing Pillowcase" ]
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading data file:', err);
  }
  return initialDatabase;
}
function saveData(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data file:', err);
  }
}

let requirementDatabase = loadData();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files in ./public
app.use(express.static(path.join(__dirname, 'public')));

// Simple health route
app.get('/health', (req, res) => res.send('OK'));

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // send full database immediately on connect
  socket.emit('database', requirementDatabase);

  // Student asks for single LRN check (optional - client can use local cache)
  socket.on('studentCheck', (lrn) => {
    const result = requirementDatabase.hasOwnProperty(lrn) ? requirementDatabase[lrn] : null;
    socket.emit('studentResult', { lrn, result });
  });

  // Admin login
  socket.on('adminLogin', ({ password }) => {
    if (password === ADMIN_PASSWORD) {
      socket.emit('adminAuth', { success: true });
    } else {
      socket.emit('adminAuth', { success: false, message: 'Incorrect password' });
    }
  });

  // Bulk add requirements
  socket.on('addRequirementsBulk', ({ lrns, reqs }) => {
    if (!Array.isArray(lrns) || !Array.isArray(reqs)) return;
    lrns.forEach(lrn => {
      if (!requirementDatabase[lrn]) requirementDatabase[lrn] = [];
      reqs.forEach(req => {
        if (!requirementDatabase[lrn].includes(req)) {
          requirementDatabase[lrn].push(req);
        }
      });
    });
    saveData(requirementDatabase);
    io.emit('databaseUpdate', requirementDatabase);
  });

  // Bulk remove requirements (set to empty array)
  socket.on('removeRequirementsBulk', ({ lrns }) => {
    if (!Array.isArray(lrns)) return;
    lrns.forEach(lrn => {
      if (requirementDatabase[lrn]) requirementDatabase[lrn] = [];
    });
    saveData(requirementDatabase);
    io.emit('databaseUpdate', requirementDatabase);
  });

  // Remove students entirely
  socket.on('removeStudentBulk', ({ lrns }) => {
    if (!Array.isArray(lrns)) return;
    lrns.forEach(lrn => {
      if (requirementDatabase.hasOwnProperty(lrn)) delete requirementDatabase[lrn];
    });
    saveData(requirementDatabase);
    io.emit('databaseUpdate', requirementDatabase);
  });

  // Remove single requirement by index
  socket.on('removeRequirement', ({ lrn, idx }) => {
    if (requirementDatabase[lrn] && typeof idx === 'number') {
      if (idx >= 0 && idx < requirementDatabase[lrn].length) {
        requirementDatabase[lrn].splice(idx, 1);
        saveData(requirementDatabase);
        io.emit('databaseUpdate', requirementDatabase);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});