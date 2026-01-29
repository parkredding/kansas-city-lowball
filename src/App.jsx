import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import GameTable from './pages/GameTable'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/game" element={<GameTable />} />
    </Routes>
  )
}

export default App
