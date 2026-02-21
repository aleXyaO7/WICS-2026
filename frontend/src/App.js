// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import './App.css';

// function App() {
//   const [songs, setSongs] = useState([]);
//   const [currentSong, setCurrentSong] = useState(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const audioRef = useRef(null);

//   const API_URL = 'http://localhost:5001/api';

//   useEffect(() => {
//     fetchSongs();
//   }, []);

//   const fetchSongs = async () => {
//     try {
//       const response = await axios.get(`${API_URL}/songs`);
//       setSongs(response.data);
//     } catch (error) {
//       console.error('Error fetching songs:', error);
//     }
//   };

//   // Resolve play/download URL: use Supabase url_original when present, else local API
//   const getSongAudioUrl = (song) => {
//     if (song.url_original) return song.url_original;
//     return `${API_URL}/songs/${song.filename}`;
//   };

//   // Play a specific song by filename
//   const playSpecificSong = (filename) => {
//     const song = songs.find(s => s.filename === filename || s.id === filename);
//     if (song) playSong(song);
//   };

//   // Download song to user's computer
//   const downloadSong = (song) => {
//     const link = document.createElement('a');
//     link.href = getSongAudioUrl(song);
//     link.download = song.name || song.filename || 'audio';
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const playSong = (song) => {
//     setCurrentSong(song);
//     setIsPlaying(true);
//     if (audioRef.current) {
//       audioRef.current.src = getSongAudioUrl(song);
//       audioRef.current.play();
//     }
//   };

//   const togglePlayPause = () => {
//     if (audioRef.current) {
//       if (isPlaying) {
//         audioRef.current.pause();
//       } else {
//         audioRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   return (
//     <div className="App">
//       <div className="container">
//         <h1>🎵 Music Player</h1>

//         <div className="songs-section">
//           <h2>My Songs ({songs.length})</h2>
//           {songs.length === 0 ? (
//             <p className="empty">No songs yet. Download songs using the backend script!</p>
//           ) : (
//             <div className="song-list">
//               {songs.map((song) => (
//                 <div
//                   key={song.id}
//                   className={`song-item ${currentSong?.id === song.id ? 'active' : ''}`}
//                   onClick={() => playSong(song)}
//                 >
//                   <span className="song-name">{song.name}</span>
//                   <span className="play-icon">
//                     {currentSong?.id === song.id && isPlaying ? '⏸' : '▶'}
//                   </span>
//                   <button 
//                     className="download-btn"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       downloadSong(song);
//                     }}
//                   >
//                     ⬇
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         {currentSong && (
//           <div className="player">
//             <div className="player-info">
//               <div className="now-playing">Now Playing:</div>
//               <div className="song-title">{currentSong.name}</div>
//             </div>
//             <div className="player-controls">
//               <button onClick={togglePlayPause} className="play-button">
//                 {isPlaying ? '⏸ Pause' : '▶ Play'}
//               </button>
//             </div>
//             <audio
//               ref={audioRef}
//               onEnded={() => setIsPlaying(false)}
//               onPlay={() => setIsPlaying(true)}
//               onPause={() => setIsPlaying(false)}
//             />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import WavPlayer from './WavPlayer';
import Login from './Login';
import Signup from './Signup';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/player" element={<WavPlayer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;