// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

export default function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabitName, setNewHabitName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = async () => {
    try {
      const habitsResponse = await fetch(`${API_URL}/habits`);
      const habitsData = await habitsResponse.json();
      
      const checkinDictionary = {};
      for (const habit of habitsData) {
        const checkinsResponse = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
        const checkinsData = await checkinsResponse.json();
        checkinDictionary[habit.id] = checkinsData;
      }

      setHabits(habitsData);
      setCheckinsByHabit(checkinDictionary);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName || newHabitName.trim() === '') {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim() }),
      });
      if (response.ok) {
        setNewHabitName('');
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async (habitId) => {
    try {
      const response = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      const response = await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getLastSevenDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      
      days.push({
        dateString: `${year}-${month}-${dayStr}`,
        dayOfMonth: d.getDate()
      });
    }
    return days;
  };

  const lastSevenDays = getLastSevenDays();

  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayString();

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <form onSubmit={handleAddHabit} className="form-row">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
          />
          <button type="submit">Add Habit</button>
        </form>
      </div>

      {isLoading ? (
        <div className="status-text">Loading your habits...</div>
      ) : habits.length === 0 ? (
        <div className="status-text">No habits yet. Add one above to get started!</div>
      ) : (
        <div className="habit-list">
          {habits.map((habit) => {
            const habitCheckins = checkinsByHabit[habit.id] || [];
            const isCheckedInToday = habitCheckins.includes(todayStr);

            return (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                
                <p className="streak-display">
                  {habit.streak > 0 
                    ? `🔥 ${habit.streak} day streak` 
                    : "No streak yet — check in today!"
                  }
                </p>

                <div className="action-row">
                  {isCheckedInToday ? (
                    <button className="checkin-btn checked-today" disabled>
                      ✅ Checked in today
                    </button>
                  ) : (
                    <button className="checkin-btn" onClick={() => handleCheckIn(habit.id)}>
                      Check In
                    </button>
                  )}
                </div>

                <div className="calendar-history">
                  {lastSevenDays.map((day) => {
                    const isDone = habitCheckins.includes(day.dateString);
                    return (
                      <div 
                        key={day.dateString} 
                        className={`calendar-box ${isDone ? 'done' : 'not-done'}`}
                        title={day.dateString}
                      >
                        {day.dayOfMonth}
                      </div>
                    );
                  })}
                </div>

                <button 
                  className="delete-btn" 
                  onClick={() => handleDeleteHabit(habit.id)}
                >
                  Delete Habit
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}