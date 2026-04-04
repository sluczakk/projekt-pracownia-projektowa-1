import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import API_BASE_URL from "../config";

export default function ExerciseList() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchExercises() {
      try {
        const response = await fetch(`${API_BASE_URL}/exercises`);

        if (!response.ok) {
          throw new Error("Failed to fetch exercises");
        }

        const data = await response.json();
        setExercises(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchExercises();
  }, []);

  const labels = {
    "easy": "łatwe",
    "medium": "średnie",
    "hard": "trudne",
  };

  if (loading) {
    return <div className="exercise-page">Ladowanie zadan...</div>;
  }

  if (error) {
    return <div className="exercise-page">Error: {error}</div>;
  }

  return (
    <div className="exercise-page">
      <div className="exercise-page-header">
        <h1>Zadania</h1>
      </div>

      <div className="exercise-list">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            className="exercise-card"
            onClick={() => navigate(`/exercises/${exercise.id}`)}
          >
            <div className="exercise-card-top">
              <h2 className="exercise-title">{exercise.title}</h2>
              <span className={`difficulty-badge difficulty-${exercise.difficulty}`}>
                {labels[exercise.difficulty]}
              </span>
            </div>

            <p className="exercise-description">{exercise.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}