import React, { useState, useEffect } from 'react';

// --- Firebase Imports ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, addDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { setLogLevel } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Setting debug log level for development visibility
setLogLevel('debug');

// --- Global Variables (Mandatory for Canvas Environment) ---
// Note: These variables are provided by the canvas environment at runtime.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Utility Functions ---

/**
 * Constructs the Firestore collection path for a user's private data.
 * @param {string} userId The current user's unique ID.
 * @returns {string} The full Firestore path.
 */
const getPrivateCollectionPath = (userId) => {
  // Path for private user data: /artifacts/{appId}/users/{userId}/todos
  return `artifacts/${appId}/users/${userId}/todos`;
};


// --- Main Application Component ---

const App = () => {
  const [todos, setTodos] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    if (!firebaseConfig) {
      setError('Firebase configuration is missing.');
      setIsLoading(false);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const userAuth = getAuth(app);

      setDb(firestore);
      setAuth(userAuth);

      // Handle initial authentication state and persistence
      const unsubscribeAuth = onAuthStateChanged(userAuth, async (user) => {
        if (!user) {
          console.log('User not signed in. Attempting sign-in...');
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(userAuth, initialAuthToken);
            } else {
              await signInAnonymously(userAuth);
            }
          } catch (e) {
            console.error('Authentication failed:', e);
            setError(`Authentication failed: ${e.message}`);
          }
        }
        // Set user ID once we have a user (anonymous or custom token)
        setUserId(userAuth.currentUser?.uid || crypto.randomUUID());
        setIsLoading(false);
      });

      return () => unsubscribeAuth();

    } catch (e) {
      console.error('Firebase Initialization Error:', e);
      setError(`Initialization Error: ${e.message}`);
      setIsLoading(false);
    }
  }, []);

  // 2. Firestore Real-time Data Listener (onSnapshot)
  useEffect(() => {
    if (!db || !userId) return;

    const path = getPrivateCollectionPath(userId);
    const q = collection(db, path);

    console.log('Setting up Firestore listener for path:', path);

    // Attach real-time listener
    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })).sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis()); // Sort by creation time

      setTodos(newTodos);
      console.log('Todos updated in real-time:', newTodos.length);
    }, (e) => {
      console.error('Firestore subscription error:', e);
      setError('Failed to load tasks. Check console for details.');
    });

    return () => unsubscribeSnapshot();
  }, [db, userId]); // Re-run listener when db or userId changes

  // --- CRUD Operations ---

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!db || !userId || newTask.trim() === '') return;

    const taskText = newTask.trim();
    setNewTask(''); // Clear input immediately

    try {
      const path = getPrivateCollectionPath(userId);
      await addDoc(collection(db, path), {
        text: taskText,
        completed: false,
        timestamp: serverTimestamp(), // Use server timestamp for ordering
      });
      console.log('Task added successfully.');
    } catch (e) {
      console.error('Error adding document:', e);
      setError('Could not add task. Please try again.');
    }
  };

  const handleToggleComplete = async (id, completed) => {
    if (!db || !userId) return;

    try {
      const path = getPrivateCollectionPath(userId);
      // Use doc(db, path, id) to reference a specific document
      await updateDoc(doc(db, path, id), {
        completed: !completed,
      });
      console.log('Task updated successfully:', id);
    } catch (e) {
      console.error('Error updating document:', e);
      setError('Could not update task status.');
    }
  };

  const handleDeleteTodo = async (id) => {
    if (!db || !userId) return;

    try {
      const path = getPrivateCollectionPath(userId);
      await deleteDoc(doc(db, path, id));
      console.log('Task deleted successfully:', id);
    } catch (e) {
      console.error('Error deleting document:', e);
      setError('Could not delete task.');
    }
  };

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading App...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50 p-4 sm:p-8 font-['Inter']">
      <div className="max-w-xl mx-auto bg-white shadow-2xl rounded-xl p-6 md:p-8">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight">
            My Responsive To-Do List
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tasks are saved in real-time with Firestore.
          </p>
        </header>

        {error && (
          <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-100 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-indigo-50 rounded-lg text-sm text-indigo-600 border border-indigo-200">
          <span className="font-semibold">Your User ID (for private data): </span>
          {userId}
        </div>

        {/* New Task Form */}
        <form onSubmit={handleAddTodo} className="flex gap-2 mb-8">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            required
          />
          <button
            type="submit"
            className="px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 active:scale-95 disabled:opacity-50"
            disabled={!db || newTask.trim() === ''}
          >
            Add Task
          </button>
        </form>

        {/* To-Do List */}
        <ul className="space-y-3">
          {todos.length === 0 ? (
            <li className="text-center p-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              No tasks yet! Add a task to get started.
            </li>
          ) : (
            todos.map((todo) => (
              <li
                key={todo.id}
                className={`flex items-center justify-between p-4 rounded-xl shadow-sm transition-all duration-300 ${
                  todo.completed ? 'bg-green-50 border-l-4 border-green-400 opacity-70' : 'bg-gray-50 border-l-4 border-gray-200 hover:shadow-md'
                }`}
              >
                <div
                  className={`flex-grow cursor-pointer ${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}
                  onClick={() => handleToggleComplete(todo.id, todo.completed)}
                >
                  {todo.text}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {/* Toggle Button (Clicking the text is easier, but keeping this for visual feedback) */}
                  <button
                    onClick={() => handleToggleComplete(todo.id, todo.completed)}
                    className={`p-1.5 rounded-full transition duration-150 ${
                      todo.completed
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                    }`}
                    aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {todo.completed ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 14.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition duration-150 active:scale-95"
                    aria-label="Delete task"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

      </div>
    </div>
  );
};

export default App;
