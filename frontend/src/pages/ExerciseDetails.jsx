import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import CodeRunner from "../components/CodeRunner";

import API_BASE_URL from "../config";

export default function ExerciseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchExercise() {
      try {
        const response = await fetch(`${API_BASE_URL}/exercises/${id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch exercise");
        }

        const data = await response.json();
        setExercise(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchExercise();
  }, [id]);

    const labels = {
        "easy": "łatwe",
        "medium": "średnie",
        "hard": "trudne",
    };

  if (loading) {
    return <div className="exercise-page">Ładowanie zadania...</div>;
  }

  if (error) {
    return <div className="exercise-page">Error: {error}</div>;
  }

  if (!exercise) {
    return <div className="exercise-page">Zadania nie znaleziono</div>;
  }

  return (
    <div className="exercise-page">
      <button className="back-button" onClick={() => navigate("/exercises")}>
        ← Powrót
      </button>

      <div className="exercise-details-card">
        <div className="exercise-card-top">
          <h1 className="exercise-details-title">{exercise.title}</h1>
          <span className={`difficulty-badge difficulty-${exercise.difficulty}`}>
            {labels[exercise.difficulty]}
          </span>
        </div>

        <div className="exercise-full-description">
          {exercise.description}
        </div>
      </div>

      <CodeRunner
        exerciseid={exercise.id}
        exerciseTitle={exercise.title}
      />
    </div>
  );
}