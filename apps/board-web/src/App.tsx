import { ToastContainer } from 'react-toastify'
import { BoardCurrentPage } from './pages/BoardCurrentPage'

function App() {
  return (
    <>
      <BoardCurrentPage />
      <ToastContainer position="bottom-right" autoClose={3000} />
    </>
  )
}

export default App
