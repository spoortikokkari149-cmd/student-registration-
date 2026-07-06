// backend/index.js

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Table schema definition for storing habits with their metadata
db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Table schema definition for tracking habit completions on specific calendar dates
db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  );
`);

/**
 * Calculates the current consecutive daily streak for a specific habit.
 * This function retrieves all recorded check-ins sorted from most recent to oldest.
 * Starting from today's date, it determines if a check-in exists for the current day.
 * If today has no check-in, it checks yesterday; if yesterday also has no check-in, the streak is broken (0).
 * If either today or yesterday has a valid check-in, it iterates backward day-by-day to count the consecutive streak.
 */
function calculateStreak(habitId) {
  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const checkinDates = new Set(rows.map(r => r.date));

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

  if (!checkinDates.has(todayStr) && !checkinDates.has(yesterdayStr)) {
    return 0;
  }

  let currentStreak = 0;
  let checkDate = checkinDates.has(todayStr) ? now : yesterday;

  while (true) {
    const cYear = checkDate.getFullYear();
    const cMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
    const cDay = String(checkDate.getDate()).padStart(2, '0');
    const currentStr = `${cYear}-${cMonth}-${cDay}`;

    if (checkinDates.has(currentStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
}

// ROUTE A — POST /habits: Creates a brand new habit entry with an empty streak.
app.post('/habits', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "name is required" });
  }

  const createdAt = new Date().toISOString();
  const info = db.prepare('INSERT INTO habits (name, created_at) VALUES (?, ?)').run(name.trim(), createdAt);
  
  const newHabit = {
    id: info.lastInsertRowid,
    name: name.trim(),
    created_at: createdAt,
    streak: 0
  };

  res.status(201).json(newHabit);
});

// ROUTE B — GET /habits: Lists all habits sorted chronologically along with their dynamic streaks.
app.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  
  const habitsWithStreaks = habits.map(habit => {
    habit.streak = calculateStreak(habit.id);
    return habit;
  });

  res.status(200).json(habitsWithStreaks);
});

// ROUTE C — POST /habits/:id/checkin: Records a daily completion check-in for a specific habit while preventing duplicate logs.
app.post('/habits/:id/checkin', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  let { date } = req.body;

  if (!date) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    date = `${year}-${month}-${day}`;
  }

  const habitExists = db.prepare('SELECT id FROM habits WHERE id = ?').get(habitId);
  if (!habitExists) {
    return res.status(404).json({ error: "Habit not found" });
  }

  try {
    const checkedAt = new Date().toISOString();
    const info = db.prepare('INSERT INTO checkins (habit_id, date, checked_at) VALUES (?, ?, ?)').run(habitId, date, checkedAt);
    
    const updatedStreak = calculateStreak(habitId);

    res.status(201).json({
      id: info.lastInsertRowid,
      habit_id: habitId,
      date: date,
      checked_at: checkedAt,
      streak: updatedStreak
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: "Already checked in for this date" });
    }
    return res.status(500).json({ error: "Database error occurred" });
  }
});

// ROUTE D — GET /habits/:id/checkins: Returns a flat array of formatted calendar dates where check-ins were registered.
app.get('/habits/:id/checkins', (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  const habitExists = db.prepare('SELECT id FROM habits WHERE id = ?').get(habitId);
  if (!habitExists) {
    return res.status(404).json({ error: "Habit not found" });
  }

  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const dateStrings = rows.map(r => r.date);

  res.status(200).json(dateStrings);
});

// ROUTE E — DELETE /habits/:id/checkin/:date: Removes a specific calendar check-in entry to undo an accidental submission.
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const dateStr = req.params.date;

  db.prepare('DELETE FROM checkins WHERE habit_id = ? AND date = ?').run(habitId, dateStr);

  res.status(200).json({ message: "Checkin removed" });
});

// ROUTE F — DELETE /habits/:id: Completely removes a habit and all associated check-in records from the system.
app.delete('/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  db.prepare('DELETE FROM checkins WHERE habit_id = ?').run(habitId);
  db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);

  res.status(200).json({ message: `Habit ${habitId} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});