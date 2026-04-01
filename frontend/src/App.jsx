import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Playground from "./pages/Playground";
import ExerciseList from "./pages/ExerciseList";

function App() {
  return (
    <BrowserRouter>
      <div className="app">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="nav-left">
            <h1 className="logo">Tester umiejętności programowania</h1>

            <Link to="/" className="nav-link">
              Piaskownica
            </Link>
            <Link to="/exercises" className="nav-link">
              Zadania
            </Link>
          </div>
        </nav>

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<Playground />} />
          <Route path="/exercises" element={<ExerciseList />} />
        </Routes>

      </div>
    </BrowserRouter>
  );
}

export default App;