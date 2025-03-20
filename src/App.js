import React from 'react';
import './App.css';
// Import both player versions
// import SimplePlayerEarthTones from './SimplePlayerEarthTones';
import SimplePlayerDark from './SimplePlayerDark';

function App() {
  // You can toggle between versions by commenting/uncommenting
  return (
    <div className="App">
      {/* <SimplePlayerEarthTones /> */}
      <SimplePlayerDark />
    </div>
  );
}

export default App;